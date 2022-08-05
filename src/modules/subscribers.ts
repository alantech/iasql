import { EntitySubscriberInterface, EventSubscriber, InsertEvent, LoadEvent, UpdateEvent } from "typeorm"

function updateNulls(entity:any) {
    const that: any = entity;
    Object.keys(entity).forEach((k) => {
        if (that[k] === null) that[k] = undefined;
    });
}

@EventSubscriber()
export class NullCheckerSubscriber implements EntitySubscriberInterface {
    afterLoad(entity: any) {
        updateNulls(entity);
    }

    afterInsert(event: InsertEvent<any>) {
        updateNulls(event.entity);
    }

    afterUpdate(event: UpdateEvent<any>) {
        updateNulls(event.entity);
    }
}