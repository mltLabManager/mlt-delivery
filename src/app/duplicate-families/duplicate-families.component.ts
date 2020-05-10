import { Component, OnInit } from '@angular/core';
import { ServerFunction, Context, SqlDatabase, EntityWhere, AndFilter, packWhere, BusyService } from '@remult/core';
import { SqlBuilder } from '../model-shared/types';
import { Families } from '../families/families';
import { FamilyStatus } from '../families/FamilyStatus';
import { DialogService } from '../select-popup/dialog';
import { GridDialogComponent } from '../grid-dialog/grid-dialog.component';
import { buildGridButtonFromActions } from '../families/familyActionsWiring';
import { familyActions, UpdateStatus, FreezeDeliveriesForFamilies, UnfreezeDeliveriesForFamilies, updateGroup } from '../families/familyActions';
import { FamiliesComponent, saveFamiliesToExcel } from '../families/families.component';
import { ApplicationSettings } from '../manage/ApplicationSettings';
import { MergeFamiliesComponent } from '../merge-families/merge-families.component';
import { Roles } from '../auth/roles';

@Component({
  selector: 'app-duplicate-families',
  templateUrl: './duplicate-families.component.html',
  styleUrls: ['./duplicate-families.component.scss']
})
export class DuplicateFamiliesComponent implements OnInit {

  constructor(private context: Context, private dialog: DialogService, private settings: ApplicationSettings, private busy: BusyService) { }
  duplicateFamilies: duplicateFamilies[] = [];
  async ngOnInit() {
    try {
      this.duplicateFamilies = await DuplicateFamiliesComponent.familiesInSameAddress();
    }
    catch (err) {
      this.dialog.Error(err);
    }
  }
  async showFamilies(d: duplicateFamilies) {
    await this.context.openDialog(GridDialogComponent, x => x.args = {
      title: 'תורמים ב' + d.address,
      buttons: [{
        text: 'מזג תורמים',
        click: async () => { await this.mergeFamilies(x); }
      }],
      settings: this.context.for(Families).gridSettings({
        columnSettings: f => [
          f.name,
          f.address,
          f.status,
          f.phone1,
          f.phone2,
          f.phone3,
          f.phone4,
          f.addressByGoogle,
          f.addressOk



        ],
        gridButton: [
          ...buildGridButtonFromActions([UpdateStatus, updateGroup, FreezeDeliveriesForFamilies, UnfreezeDeliveriesForFamilies], this.context,
            {
              afterAction: async () => await x.args.settings.getRecords(),
              dialog: this.dialog,
              callServer: async (info, action, args) => await FamiliesComponent.FamilyActionOnServer(info, action, args),
              buildActionInfo: async actionWhere => {
                let where: EntityWhere<Families> = f => {
                  let r = new AndFilter(actionWhere(f), x.args.settings.buildFindOptions().where(f));
                  if (x.args.settings.selectedRows.length >= 1)
                    r = new AndFilter(r, f.id.isIn(...x.args.settings.selectedRows.map(x => x.id.value)));
                  return r;
                };
                return {
                  count: await this.context.for(Families).count(where),
                  actionRowsFilterInfo: packWhere(this.context.for(Families).create(), where)
                };
              }, settings: this.settings,
              groupName: 'תורמים'
            })
          , {
            name: 'מיזוג תורמים',
            click: async () => {
              await this.mergeFamilies(x);

            },
            visible: () => this.context.isAllowed(Roles.admin) && (x.args.settings.selectedRows.length > 1 || x.args.settings.totalRows < 10)
          }, {
            name: 'יצוא לאקסל',
            click: async () => {
              await saveFamiliesToExcel(this.context, x.args.settings, this.busy)
            }
          }],
        allowSelection: true,
        knowTotalRows: true,
        rowButtons: [
          {
            name: 'פרטי תורם',
            click: f => f.showFamilyDialog()
          },
          {
            name: 'משלוחים',
            click: f => f.showDeliveryHistoryDialog()
          }
        ],
        get: {
          limit: 25,
          where: f => f.status.isDifferentFrom(FamilyStatus.ToDelete).and(f.addressLatitude.isEqualTo(d.lat).and(f.addressLongitude.isEqualTo(d.lng))),
          orderBy: f => f.name
        }

      })

    });
    this.ngOnInit();
  }

  private async mergeFamilies(x: GridDialogComponent) {
    let items = x.args.settings.selectedRows.length > 0 ? [...x.args.settings.selectedRows] : [...x.args.settings.items];
    if (items.length == 0) {
      await this.dialog.Error('לא נבחרו תורמים');
      return;
    }
    if (items.length == 1) {
      await this.dialog.Error('אין מה למזג תורם אחד');
      return;
    }
    if (items.length > 10) {
      await this.dialog.Error('יותר מידי תורמים בבת אחת');
      return;
    }
    await this.context.openDialog(MergeFamiliesComponent, y => y.families = items, y => {
      if (y.merged)
        x.args.settings.getRecords();
    });
  }

  @ServerFunction({ allowed: true })
  static async familiesInSameAddress(context?: Context, db?: SqlDatabase) {
    let sql = new SqlBuilder();
    let f = context.for(Families).create();
    return (await db.execute(sql.query({
      select: () => [
        sql.max(f.createDate),
        sql.columnWithAlias(f.addressLatitude, 'lat'),
        sql.columnWithAlias(f.addressLongitude, 'lng'),
        sql.columnWithAlias(sql.max(f.address), 'address'),
        sql.columnWithAlias(sql.count(), 'c')],
      from: f,
      where: () => [f.status.isDifferentFrom(FamilyStatus.ToDelete)],
      groupBy: () => [f.addressLatitude, f.addressLongitude],
      having: () => [sql.gt(sql.count(), 1)]

    }))).rows.map(x => ({
      address: x['address'],
      lat: +x['lat'],
      lng: +x['lng'],
      count: +x['c']
    } as duplicateFamilies));
  }

}
export interface duplicateFamilies {
  address: string,
  lat: number,
  lng: number,
  count: number
}
