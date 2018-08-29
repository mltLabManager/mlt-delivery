import { FamilyDelveryEventId, FamilyDeliveryEvents } from '../delivery-events/FamilyDeliveryEvents';
import { FamilyId } from './families';
import { DeliveryStatusColumn } from "./DeliveryStatus";
import { BasketId } from "./BasketType";
import { DataProviderFactory, StringColumn } from 'radweb';
import { evilStatics } from '../auth/evil-statics';
import { HelperId } from '../helpers/helpers';
import { IdEntity, changeDate, DateTimeColumn, buildSql } from '../model-shared/types';
import { DeliveryEvents } from '../delivery-events/delivery-events';
import { Context, ServerContext } from '../shared/context';
import { ApiAccess } from '../server/api-interfaces';


let fde = new FamilyDeliveryEvents(new ServerContext({}));
var de = new DeliveryEvents(new ServerContext({}));


export class FamilyDeliveryEventsView extends IdEntity<FamilyDelveryEventId>  {

  family = new FamilyId();
  basketType = new BasketId(this.context, 'סוג סל');
  eventName = new StringColumn('שם אירוע');
  deliveryDate = new DateTimeColumn('תאריך החלוקה');
  courier = new HelperId(this.context, "משנע");
  courierAssingTime = new changeDate('מועד שיוך למשנע');
  deliverStatus = new DeliveryStatusColumn('סטטוס שינוע');
  deliveryStatusDate = new changeDate('מועד סטטוס שינוע');
  courierComments = new StringColumn('הערות מסירה');
  constructor(private context: Context, source?: DataProviderFactory) {
    super(new FamilyDelveryEventId(), FamilyDeliveryEventsView, {
      name: 'FamilyDeliveryEventsView',
      apiAccess: ApiAccess.AdminOnly,
      dbName: buildSql('(select ', fde, '.', fde.id, ', ', [fde.family, fde.basketType, fde.courier, fde.courierAssingTime, fde.deliverStatus, fde.deliveryStatusDate, fde.courierComments, de.deliveryDate], ', ', de, '.', de.name, ' eventName', ' from ', fde, ' inner join ', de, ' on ', de, '.', de.id, '=', fde.deliveryEvent, ' where ', de.isActiveEvent, '=false', ') as x')
    });
    this.initColumns();
  }

}