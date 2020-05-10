import { Component, OnInit } from '@angular/core';
import { Families } from '../families/families';
import { Context, Column, GridSettings, ServerFunction } from '@remult/core';
import { MatDialogRef } from '@angular/material';
import { Roles } from '../auth/roles';
import { DialogService, extractError } from '../select-popup/dialog';
import { FamilyDeliveries, ActiveFamilyDeliveries } from '../families/FamilyDeliveries';
import { UpdateFamilyDialogComponent } from '../update-family-dialog/update-family-dialog.component';
import { DeliveryStatus } from '../families/DeliveryStatus';

@Component({
  selector: 'app-merge-families',
  templateUrl: './merge-families.component.html',
  styleUrls: ['./merge-families.component.scss']
})
export class MergeFamiliesComponent implements OnInit {

  constructor(private context: Context, private dialogRef: MatDialogRef<any>, private dialog: DialogService) { }
  families: Families[] = [];
  family: Families;
  async ngOnInit() {
    this.families.sort((a, b) => b.createDate.value.valueOf() - a.createDate.value.valueOf());
    this.families.sort((a, b) => a.status.value.id - b.status.value.id);
    this.family = await this.context.for(Families).findId(this.families[0].id.value);
    this.family._disableAutoDuplicateCheck = true;
    this.rebuildCompare(true);
  }
  rebuildCompare(updateValue: boolean) {
    this.columnsToCompare.splice(0);
    for (const c of this.family.columns) {
      if (c.defs.allowApiUpdate === undefined || this.context.isAllowed(c.defs.allowApiUpdate)) {
        switch (c) {
          case this.family.addressApiResult:
          case this.family.addressLatitude:
          case this.family.addressLongitude:
          case this.family.addressByGoogle:
          case this.family.addressOk:
          case this.family.drivingLongitude:
          case this.family.drivingLatitude:
          case this.family.previousDeliveryComment:
          case this.family.previousDeliveryDate:
          case this.family.previousDeliveryStatus:
          case this.family.nextBirthday:
            continue;

        }
        for (const f of this.families) {
          if (f.columns.find(c).value != c.value) {
            if (!c.value && updateValue)
              c.value = f.columns.find(c).value;
            this.columnsToCompare.push(c);
            break;
          }
        }
      }
    }
    this.gs = this.context.for(Families).gridSettings({ allowUpdate: true, columnSettings: () => this.columnsToCompare });
    for (const c of this.gs.columns.items) {
      this.width.set(c.column, this.gs.columns.__dataControlStyle(c));
    }

  }
  gs: GridSettings<any>;
  getColWidth(c: Column<any>) {
    let x = this.width.get(c);
    if (!x)
      x = '200px';
    return x;
  }
  async updateFamily(f: Families) {
    await this.context.openDialog(UpdateFamilyDialogComponent, x => {
      x.args = { family: f, userCanUpdateButDontSave: true }
    });
    this.rebuildCompare(false);
  }
  async updateCurrentFamily() {
    await this.context.openDialog(UpdateFamilyDialogComponent, x => {
      x.args = { family: this.family, userCanUpdateButDontSave: true }
    });
    this.rebuildCompare(false);
  }
  async confirm() {
    try {
      await this.family.save();
      await MergeFamiliesComponent.mergeFamilies(this.families.map(x => x.id.value));
      this.merged = true;
      this.dialogRef.close();
      let deliveries = await this.context.for(ActiveFamilyDeliveries).count(fd => fd.family.isEqualTo(this.family.id).and(fd.deliverStatus.isNotAResultStatus()))
      if (deliveries > 1) {
        if (await this.dialog.YesNoPromise("יש " + deliveries + " משלוחים פעילים לתורם - להציג אותם?"))
          await this.family.showDeliveryHistoryDialog();
      }
    }
    catch (err) {
      this.dialog.Error('מיזוג תורמים ' + extractError(err));
    }
  }
  merged = true;
  cancel() {
    this.dialogRef.close();
  }

  @ServerFunction({ allowed: Roles.admin })
  static async mergeFamilies(ids: string[], context?: Context) {
    let id = ids.splice(0, 1)[0];
    let newFamily = await context.for(Families).findId(id);

    for (const oldId of ids) {
      for (const fd of await context.for(FamilyDeliveries).find({ where: fd => fd.family.isEqualTo(oldId) })) {
        fd.family.value = id;
        newFamily.updateDelivery(fd);
        await fd.save();
      }
      (await context.for(Families).findId(oldId)).delete();
    }
  }


  columnsToCompare: Column<any>[] = [];
  width = new Map<Column<any>, string>();

}
