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

  // creates it if it doesn't exist
  static async getNewOrExistingUser(email: string, uid: string) {
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

  static async getTeamMetadata(teamId: string) {
    const resp = await this.client.get(`/teams/v1/${teamId}/metadata`);
    return resp.data;
  }
}