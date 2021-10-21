import axios from 'axios'

import config from '../../config'

export class IronPlans {
  static client = axios.create({
    baseURL: 'https://api.ironplans.com',
    headers: {
      'Authorization': `Bearer ${config.ironPlansTk}`,
      'Content-Type': 'application/json',
    }
  });

  static async newUser(email: string, uid: string) {
    const resp = await this.client.post('/customers/v1',
      {
        'identity': {
          'email': email
        },
        'source_id': uid,
      }
    );
    const body: any = resp.data;
    return {
      teamId: body.teams[0].id,
      uid: body.id,
    }
  }

  // sets the entire team metadata, overwritting any existing value
  static async setTeamMetadata(teamId: string, data: object) {
    await this.client.post(`teams/v1/${teamId}/metadata`, data);
  }

  static async mergeTeamMetadata(teamId: string, data: object) {
    await this.client.patch(`teams/v1/${teamId}/metadata`, data);
  }

  // TODO assumes every user has only one team
  static async getTeamId(uid: string) {
    let resp = await this.client.get(`/customers/v1?source_id=${uid}`);
    let body: any = resp.data;
    const ipUid = body.results[0].id;
    resp = await this.client.get(`/team_memberships/v1?customer_id=${ipUid}`);
    body = resp.data;
    return body.results[0].team_id;
  }

  static async getTeamMetadata(teamId: string) {
    const resp = await this.client.get(`/teams/v1/${teamId}/metadata`);
    return resp.data;
  }
}