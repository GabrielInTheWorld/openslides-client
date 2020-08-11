import { Component, Input, OnDestroy } from '@angular/core';

import { Subscription } from 'rxjs';

import { ActiveMeetingService } from 'app/core/core-services/active-meeting.service';
import { MotionPollRepositoryService } from 'app/core/repositories/motions/motion-poll-repository.service';
import { UserRepositoryService } from 'app/core/repositories/users/user-repository.service';
import { ComponentServiceCollector } from 'app/core/ui-services/component-service-collector';
import { BaseComponent } from 'app/site/base/components/base.component';
import { ViewUser } from 'app/site/users/models/view-user';
import { BaseViewPoll } from '../../models/base-view-poll';

@Component({
    selector: 'os-poll-progress',
    templateUrl: './poll-progress.component.html',
    styleUrls: ['./poll-progress.component.scss']
})
export class PollProgressComponent extends BaseComponent implements OnDestroy {
    private pollId: number = null;
    private pollSubscription: Subscription = null;

    @Input()
    public set poll(value: BaseViewPoll) {
        if (value.id !== this.pollId) {
            this.pollId = value.id;

            this.unsubscribePoll();
            this.pollSubscription = this.pollRepo.getViewModelObservable(this.pollId).subscribe(poll => {
                if (poll) {
                    this._poll = poll;
                    this.updateVotescast();
                    this.calculateMaxUsers();
                }
            });
        }
    }
    public get poll(): BaseViewPoll {
        return this._poll;
    }
    private _poll: BaseViewPoll;

    public votescast = 0;
    public max: number;
    public valueInPercent: number;

    public constructor(
        componentServiceCollector: ComponentServiceCollector,
        private userRepo: UserRepositoryService,
        private pollRepo: MotionPollRepositoryService,
        private activeMeetingService: ActiveMeetingService
    ) {
        super(componentServiceCollector);
        this.userRepo.getViewModelListObservable().subscribe(users => {
            if (users) {
                this.calculateMaxUsers(users);
            }
        });
    }

    private updateVotescast(): void {
        if (this.poll.votescast === 0) {
            this.votescast = 0;
            return;
        }

        // We may cannot use this.poll.votescast during the voting, since it can
        // be reported with false values from the server
        // -> calculate the votes on our own.
        const ids = new Set();
        for (const option of this.poll.options) {
            for (const vote of option.votes) {
                if (vote.user_id) {
                    ids.add(vote.user_id);
                }
            }
        }
        if (ids.size > this.votescast) {
            this.votescast = ids.size;
        }

        // But sometimes there are not enough votes (poll.votescast is higher).
        // If this happens, take the value from the poll
        if (this.poll.votescast > this.votescast) {
            this.votescast = this.poll.votescast;
        }
    }

    private calculateMaxUsers(allUsers?: ViewUser[]): void {
        if (!this.poll) {
            return;
        }
        if (!allUsers) {
            allUsers = this.userRepo.getViewModelList();
        }

        allUsers = allUsers.filter(
            user =>
                user.isPresentInMeeting() &&
                this.poll.entitled_group_ids.intersect(user.group_ids(this.activeMeetingService.meetingId)).length
        );

        this.max = allUsers.length;
        this.valueInPercent = this.poll ? (this.votescast / this.max) * 100 : 0;
    }

    public ngOnDestroy(): void {
        this.unsubscribePoll();
    }

    private unsubscribePoll(): void {
        if (this.pollSubscription !== null) {
            this.pollSubscription.unsubscribe();
            this.pollSubscription = null;
        }
    }
}
