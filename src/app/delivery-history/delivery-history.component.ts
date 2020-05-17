import { Component, OnInit } from '@angular/core';
import { EntityClass, Context, StringColumn, IdColumn, SpecificEntityHelper, SqlDatabase, Column } from '@remult/core';
import { FamilyId } from '../families/families';
import { changeDate, SqlBuilder, PhoneColumn } from '../model-shared/types';
import { BasketId } from '../families/BasketType';
import { DeliveryStatusColumn } from '../families/DeliveryStatus';
import { HelperId, HelperIdReadonly, Helpers, CompanyColumn } from '../helpers/helpers';
import { FamilyDeliveries } from '../families/FamilyDeliveries';
import { CompoundIdColumn, DateColumn, DataAreaSettings, InMemoryDataProvider, Entity, GridSettings, NumberColumn } from '@remult/core';

import { Route } from '@angular/router';


import { saveToExcel } from '../shared/saveToExcel';
import { BusyService } from '@remult/core';
import { FamilySourceId } from '../families/FamilySources';
import { ServerFunction } from '@remult/core';
import { Roles, AdminGuard } from '../auth/roles';
import { ApplicationSettings } from '../manage/ApplicationSettings';
import { DistributionCenterId } from '../manage/distribution-centers';
import {translate} from '../translate'

var fullDayValue = 24 * 60 * 60 * 1000;

@Component({
  selector: 'app-delivery-history',
  templateUrl: './delivery-history.component.html',
  styleUrls: ['./delivery-history.component.scss']
})
export class DeliveryHistoryComponent implements OnInit {

  fromDate = new DateColumn({
    caption: 'מתאריך',
    valueChange: () => {

      if (this.toDate.value < this.fromDate.value) {
        this.toDate.value = this.getEndOfMonth();
      }

    }
  });
  toDate = new DateColumn('עד תאריך');
  rangeArea = new DataAreaSettings({
    columnSettings: () => [this.fromDate, this.toDate],
    numberOfColumnAreas: 2
  });

  helperInfo: GridSettings<helperHistoryInfo>;


  private getEndOfMonth(): Date {
    return new Date(this.fromDate.value.getFullYear(), this.fromDate.value.getMonth() + 1, 0);
  }

  async refresh() {
    this.deliveries.getRecords();
    await this.refreshHelpers();
  }
  static route: Route = {
    path: 'history',
    component: DeliveryHistoryComponent,
    data: { name: 'היסטורית משלוחים' }, canActivate: [AdminGuard]
  }
  helperStorage: InMemoryDataProvider;
  constructor(private context: Context, private busy: BusyService) {
    this.helperStorage = new InMemoryDataProvider();


    this.helperInfo = context.for(helperHistoryInfo, this.helperStorage).gridSettings({
      hideDataArea: true,
      numOfColumnsInGrid: 6,
      gridButton: [{
        name: 'יצוא לאקסל',
        visible: () => this.context.isAllowed(Roles.admin),
        click: async () => {
          await saveToExcel(this.context.for(helperHistoryInfo), this.helperInfo, "מתנדבים", this.busy, (d: helperHistoryInfo, c) => c == d.courier);
        }
      }],
      columnSettings: h => [
        {
          column: h.name,
          width: '150'
        },
        {
          column: h.phone,
          width: '140'
        },
        {
          column: h.company,
          width: '150'
        },
        {
          column: h.deliveries,
          width: '75'
        },
        {
          column: h.families,
          caption: translate('משפחות'),
          width: '75'
        },
        {
          column: h.dates,
          width: '75'
        }
      ],
      get: {
        limit: 100,
        orderBy: h => [{ column: h.deliveries, descending: true }]
      },
      knowTotalRows: true
    });

    let today = new Date();

    this.fromDate.value = new Date(today.getFullYear(), today.getMonth(), 1);
    this.toDate.value = this.getEndOfMonth();
  }
  private async refreshHelpers() {

    var x = await DeliveryHistoryComponent.getHelperHistoryInfo(this.fromDate.rawValue, this.toDate.rawValue);
    let rows: any[] = this.helperStorage.rows[this.context.for(helperHistoryInfo).create().defs.dbName];
    x = x.map(x => {
      x.deliveries = +x.deliveries;
      x.dates = +x.dates;
      x.families = +x.families;
      return x;
    });
    rows.splice(0, rows.length, ...x);
    this.helperInfo.getRecords();
  }

  today() {
    this.fromDate.value = new Date();
    this.toDate.value = new Date();
    this.refresh();

  }
  next() {
    this.setRange(+1);
  }
  previous() {

    this.setRange(-1);
  }
  private setRange(delta: number) {
    if (this.fromDate.value.getDate() == 1 && this.toDate.value.toDateString() == this.getEndOfMonth().toDateString()) {
      this.fromDate.value = new Date(this.fromDate.value.getFullYear(), this.fromDate.value.getMonth() + delta, 1);
      this.toDate.value = this.getEndOfMonth();
    } else {
      let difference = Math.abs(this.toDate.value.getTime() - this.fromDate.value.getTime());
      if (difference < fullDayValue)
        difference = fullDayValue;
      difference *= delta;
      let to = this.toDate.value;
      this.fromDate.value = new Date(this.fromDate.value.getTime() + difference);
      this.toDate.value = new Date(to.getTime() + difference);

    }
    this.refresh();
  }



  deliveries = this.context.for(FamilyDeliveries).gridSettings({
    gridButton: [{
      name: 'יצוא לאקסל',
      click: async () => {
        await saveToExcel(this.context.for(FamilyDeliveries), this.deliveries, "משלוחים", this.busy, (d: FamilyDeliveries, c) => c == d.id || c == d.family, undefined,
          async (f, addColumn) => await f.basketType.addBasketTypes(f.quantity, addColumn));
      }, visible: () => this.context.isAllowed(Roles.admin)
    }],
    columnSettings: d => {
      let r: Column<any>[] = [
        d.name,
        d.courier,
        d.deliveryStatusDate,
        d.deliverStatus,
        d.basketType,
        d.quantity,
        d.city,
        d.familySource,
        d.courierComments,
        d.courierAssignUser,
        d.courierAssingTime,
        d.deliveryStatusUser
      ]
      for (const c of d.columns) {
        if (!r.includes(c) && c != d.id && c != d.family)
          r.push(c);
      }
      return r;
    },

    hideDataArea: true,
    numOfColumnsInGrid: 6,
    knowTotalRows: true,
    get: {
      limit: 20,
      where: d => {
        var toDate = this.toDate.value;
        toDate = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate() + 1);
        return d.deliveryStatusDate.isGreaterOrEqualTo(this.fromDate.value).and(d.deliveryStatusDate.isLessThan(toDate)).and(d.deliverStatus.isAResultStatus())
      }
    }
  });
  async ngOnInit() {

    this.refreshHelpers();

  }
  @ServerFunction({ allowed: Roles.admin })
  static async  getHelperHistoryInfo(fromDate: string, toDate: string, context?: Context, db?: SqlDatabase) {
    var fromDateDate = DateColumn.stringToDate(fromDate);
    var toDateDate = DateColumn.stringToDate(toDate);
    toDateDate = new Date(toDateDate.getFullYear(), toDateDate.getMonth(), toDateDate.getDate() + 1);
    var sql = new SqlBuilder();
    var fd = context.for(FamilyDeliveries).create();
    var h = context.for(Helpers).create();

    return (await db.execute(
      sql.build("select ", [
        fd.courier.defs.dbName,
        sql.columnInnerSelect(fd, {
          select: () => [h.name],
          from: h,
          where: () => [sql.build(h.id, "=", fd.courier.defs.dbName)]
        }),
        sql.columnInnerSelect(fd, {
          select: () => [h.company],
          from: h,
          where: () => [sql.build(h.id, "=", fd.courier.defs.dbName)]
        }),
        sql.columnInnerSelect(fd, {
          select: () => [h.phone],
          from: h,
          where: () => [sql.build(h.id, "=", fd.courier.defs.dbName)]
        })
        , "deliveries", "dates", "families"], " from (",
        sql.build("select ", [
          fd.courier.defs.dbName,
          "count(*) deliveries",
          sql.build("count (distinct date (", fd.courierAssingTime.defs.dbName, ")) dates"),
          sql.build("count (distinct ", fd.family.defs.dbName, ") families")],
          ' from ', fd.defs.dbName,
          ' where ', sql.and(fd.deliveryStatusDate.isGreaterOrEqualTo(fromDateDate).and(fd.deliveryStatusDate.isLessThan(toDateDate).and(fd.deliverStatus.isAResultStatus()))))

        + sql.build(' group by ', fd.courier.defs.dbName), ") x"))).rows;

  }

}
@EntityClass
export class helperHistoryInfo extends Entity<string>{
  courier = new StringColumn();
  name = new StringColumn('שם');
  phone = new PhoneColumn("טלפון");
  company = new CompanyColumn(this.context);
  deliveries = new NumberColumn('משלוחים');
  families = new NumberColumn('משפחות');
  dates = new NumberColumn("תאריכים");
  constructor(private context: Context) {
    super({ name: 'helperHistoryInfo', allowApiRead: false, allowApiCRUD: false });

  }
}

