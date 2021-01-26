import { AgendaItemType } from 'app/shared/models/agenda/agenda-item';

export interface AgendaItemCreationPayload {
    // Non-model fields for customizing the agenda item creation, optional
    agenda_create?: boolean;
    agenda_type?: AgendaItemType;
    agenda_parent_id?: number;
    agenda_comment?: string;
    agenda_duration?: number;
    agenda_weight?: number;
}
