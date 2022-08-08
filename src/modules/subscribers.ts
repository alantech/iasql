import { EntitySubscriberInterface, EventSubscriber, InsertEvent, LoadEvent, UpdateEvent } from "typeorm"

function updateNulls(entity:any) {
    if (entity) {
        const that: any = entity;
        Object.keys(entity).forEach((k) => {
            console.log("i iterate for");
            console.log(k);
            console.log(that[k]);
            if (that[k] === null) that[k] = undefined;
            console.log("after");
            console.log(that[k]);
        });
    }
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