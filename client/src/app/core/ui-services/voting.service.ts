import { Injectable } from '@angular/core';

import { marker as _ } from '@biesbjerg/ngx-translate-extract-marker';

import { PollState, PollType } from 'app/shared/models/poll/poll-constants';
import { ViewPoll } from 'app/shared/models/poll/view-poll';
import { ViewUser } from 'app/site/users/models/view-user';
import { OperatorService } from '../core-services/operator.service';

export enum VotingError {
    POLL_WRONG_STATE = 1, // 1 so we can check with negation
    POLL_WRONG_TYPE,
    USER_HAS_NO_PERMISSION,
    USER_IS_ANONYMOUS,
    USER_NOT_PRESENT,
    USER_HAS_DELEGATED_RIGHT
}

/**
 * TODO: It appears that the only message that makes sense for the user to see it the last one.
 */
const VotingErrorVerbose = {
    1: _('You can not vote right now because the voting has not yet started.'),
    2: _('You can not vote because this is an analog voting.'),
    3: _('You do not have the permission to vote.'),
    4: _('You have to be logged in to be able to vote.'),
    5: _('You have to be present to vote.'),
    6: _('Your voting right was delegated to another person.'),
    7: _('You have already voted.')
};

@Injectable({
    providedIn: 'root'
})
export class VotingService {
    public constructor(private operator: OperatorService) {}

    /**
     * checks whether the operator can vote on the given poll
     */
    public canVote(poll: ViewPoll, user?: ViewUser): boolean {
        const error = this.getVotePermissionError(poll, user);
        return !error;
    }

    /**
     * checks whether the operator can vote on the given poll
     * @returns null if no errors exist (= user can vote) or else a VotingError
     */
    public getVotePermissionError(
        poll: ViewPoll,
        user: ViewUser = null /*this.operator.viewUser*/
    ): VotingError | void {
        if (this.operator.isAnonymous) {
            return VotingError.USER_IS_ANONYMOUS;
        }
        // TODO: enable. Currently this fals, becuase poll.groups_id is null (The accessor must be entitled_group_ids)
        /*if (!this.operator.isInGroupIdsNonAdminCheck(...poll.groups_id)) {
            return VotingError.USER_HAS_NO_PERMISSION;
        }*/
        if (poll.type === PollType.Analog) {
            return VotingError.POLL_WRONG_TYPE;
        }
        if (poll.state !== PollState.Started) {
            return VotingError.POLL_WRONG_STATE;
        }
        // TODO: This is not possible anymore
        /*
        if (!user.is_present && !this.operator.viewUser.canVoteFor(user)) {
            return VotingError.USER_NOT_PRESENT;
        }
        if (user.isVoteRightDelegated && this.operator.user.id === user.id) {
            return VotingError.USER_HAS_DELEGATED_RIGHT;
        }*/
    }

    public getVotePermissionErrorVerbose(
        poll: ViewPoll,
        user: ViewUser = null /*this.operator.viewUser*/
    ): string | void {
        const error = this.getVotePermissionError(poll, user);
        if (error) {
            return VotingErrorVerbose[error];
        }
    }
}
