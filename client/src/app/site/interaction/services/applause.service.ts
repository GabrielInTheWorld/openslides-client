import { Injectable } from '@angular/core';
import { MeetingSettingsService } from 'app/core/ui-services/meeting-settings.service';

import { Observable, Subject } from 'rxjs';
import { distinctUntilChanged, filter, map } from 'rxjs/operators';

import { HttpService } from '../../../core/core-services/http.service';
import { NotifyService } from '../../../core/core-services/notify.service';

export interface Applause {
    level: number;
    presentUsers: number;
}

export enum ApplauseType {
    particles = 'applause-type-particles',
    bar = 'applause-type-bar'
}

const applausePath = '/system/applause'; // TODO
const applauseNotifyMessageName = 'applause'; // TODO

@Injectable({
    providedIn: 'root'
})
export class ApplauseService {
    private minApplauseLevel: number;
    private maxApplauseLevel: number;
    private presentApplauseUsers: number;
    private applauseTypeObservable: Observable<ApplauseType>;

    public showApplause: Observable<boolean>;
    public showApplauseLevel: boolean;
    public applauseTimeout: number;

    private applauseLevelSubject: Subject<number> = new Subject<number>();
    public applauseLevelObservable: Observable<number> = this.applauseLevelSubject.asObservable();

    private get maxApplause(): number {
        return this.maxApplauseLevel || this.presentApplauseUsers || 0;
    }

    public get showParticles(): Observable<boolean> {
        return this.applauseTypeObservable.pipe(map(type => type === ApplauseType.particles));
    }

    public get showBar(): Observable<boolean> {
        return this.applauseTypeObservable.pipe(map(type => type === ApplauseType.bar));
    }

    public constructor(
        settingService: MeetingSettingsService,
        private httpService: HttpService,
        private notifyService: NotifyService
    ) {
        this.showApplause = settingService.get('applause_enable');
        this.applauseTypeObservable = settingService.get('applause_type');

        settingService.get('applause_min_amount').subscribe(minLevel => {
            this.minApplauseLevel = minLevel;
        });
        settingService.get('applause_max_amount').subscribe(maxLevel => {
            this.maxApplauseLevel = maxLevel;
        });
        settingService.get('applause_show_level').subscribe(show => {
            this.showApplauseLevel = show;
        });
        settingService.get('applause_timeout').subscribe(timeout => {
            this.applauseTimeout = (timeout || 1) * 1000;
        });
        this.notifyService
            .getMessageObservable<Applause>(applauseNotifyMessageName)
            .pipe(
                map(notify => notify.message as Applause),
                /**
                 * only updates when the effective applause level changes
                 */
                distinctUntilChanged((prev, curr) => {
                    return prev.level === curr.level;
                }),
                filter(curr => {
                    return curr.level === 0 || curr.level >= this.minApplauseLevel;
                })
            )
            .subscribe(applause => {
                this.presentApplauseUsers = applause.presentUsers;
                this.applauseLevelSubject.next(applause.level);
            });
    }

    public async sendApplause(): Promise<void> {
        await this.httpService.post(applausePath);
    }

    public getApplauseQuote(applauseLevel: number): number {
        if (!applauseLevel) {
            return 0;
        }
        const quote = applauseLevel / this.maxApplause || 0;
        return quote > 1 ? 1 : quote;
    }
}
