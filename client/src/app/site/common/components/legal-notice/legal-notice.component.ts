import { Component, OnInit } from '@angular/core';

import { DataStoreService } from 'app/core/core-services/data-store.service';
import { OpenSlidesService } from 'app/core/core-services/openslides.service';
import { OperatorService, Permission } from 'app/core/core-services/operator.service';
import { ComponentServiceCollector } from 'app/core/ui-services/component-service-collector';
import { UpdateService } from 'app/core/ui-services/update.service';
import { BaseComponent } from 'app/site/base/components/base.component';

@Component({
    selector: 'os-legal-notice',
    templateUrl: './legal-notice.component.html'
})
export class LegalNoticeComponent extends BaseComponent implements OnInit {
    /**
     * Whether this component is in editing-mode.
     */
    public isEditing = false;

    /**
     * Holds the current legal-notice.
     */
    public legalNotice = '';

    public showDevTools = false;

    /**
     * Constructor.
     */
    public constructor(
        componentServiceCollector: ComponentServiceCollector,
        private openSlidesService: OpenSlidesService,
        private update: UpdateService,
        private operator: OperatorService,
        private DS: DataStoreService
    ) {
        super(componentServiceCollector);
    }

    public ngOnInit(): void {
        super.setTitle(this.translate.instant('Legal notice'));
    }

    public resetCache(): void {
        this.openSlidesService.reset();
    }

    public checkForUpdate(): void {
        this.update.checkForUpdate();
    }

    /**
     * Saves changes.
     */
    public saveChanges(): void {
        /*this.configRepo
            .bulkUpdate([{ key: 'general_event_legal_notice', value: this.legalNotice }])
            .then(() => (this.isEditing = !this.isEditing), this.raiseError);
        */
        throw new Error('TODO');
    }

    /**
     * Returns, if the current user has the necessary permissions.
     */
    public canManage(): boolean {
        return this.operator.hasPerms(Permission.coreCanManageConfig);
    }

    public printDS(): void {
        this.DS.print();
    }

    public getThisComponent(): void {
        console.log(this);
    }
}
