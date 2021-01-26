import { Fqid, Id } from 'app/core/definitions/key-types';
import { BaseModel } from '../base/base-model';
import { HasMeetingId } from '../base/has-meeting-id';
import { HasProjectableIds } from '../base/has-projectable-ids';
import { HasTagIds } from '../base/has-tag-ids';

export enum AgendaItemType {
    common = 'common',
    internal = 'internal',
    hidden = 'hidden'
}

/**
 * Determine type for agenda items
 */
export const ItemTypeChoices = [
    { key: AgendaItemType.common, name: 'public', csvName: '' },
    { key: AgendaItemType.internal, name: 'internal', csvName: 'internal' },
    { key: AgendaItemType.hidden, name: 'hidden', csvName: 'hidden' }
];

/**
 * Representations of agenda Item
 * @ignore
 */
export class AgendaItem extends BaseModel<AgendaItem> {
    public static COLLECTION = 'agenda_item';

    public id: Id;
    public item_number: string;
    public comment: string;
    public closed: boolean;
    public type: AgendaItemType;
    public is_hidden: boolean;
    public is_internal: boolean;
    public duration: number; // in seconds
    public weight: number;
    public level: number;

    public content_object_id: Fqid; // */agenda_item_id;
    public parent_id?: Id; // agenda_item/child_ids;
    public child_ids: Id[]; // (agenda_item/parent_id)[];

    public constructor(input?: any) {
        super(AgendaItem.COLLECTION, input);
    }
}
export interface AgendaItem extends HasMeetingId, HasProjectableIds, HasTagIds {}
