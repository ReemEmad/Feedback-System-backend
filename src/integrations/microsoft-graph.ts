import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import collaborationTracker from '../services/collaboration-tracker';

interface GraphConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

class MicrosoftGraphIntegration {
  private client: Client | null = null;
  private config: GraphConfig | null = null;

  /**
   * Initialize the Graph API client
   */
  async initialize(config: GraphConfig): Promise<void> {
    this.config = config;

    const credential = new ClientSecretCredential(
      config.tenantId,
      config.clientId,
      config.clientSecret
    );

    this.client = Client.initWithMiddleware({
      authProvider: {
        getAccessToken: async () => {
          const token = await credential.getToken('https://graph.microsoft.com/.default');
          return token.token;
        },
      },
    });

    console.log('✅ Microsoft Graph API client initialized');
  }

  /**
   * Sync employees from Azure AD
   */
  async syncEmployees(): Promise<any[]> {
    if (!this.client) {
      throw new Error('Graph client not initialized');
    }

    try {
      const response = await this.client
        .api('/users')
        .select('id,displayName,mail,jobTitle,department,manager')
        .get();

      const employees = response.value.map((user: any) => ({
        azure_id: user.id,
        email: user.mail || user.userPrincipalName,
        name: user.displayName,
        role: user.jobTitle,
        department: user.department,
      }));

      console.log(`✅ Synced ${employees.length} employees from Azure AD`);
      return employees;
    } catch (error) {
      console.error('❌ Error syncing employees:', error);
      throw error;
    }
  }

  /**
   * Get chat messages between users (collaboration data)
   */
  async getChatInteractions(userId: string, startDate: Date, endDate: Date): Promise<any[]> {
    if (!this.client) {
      throw new Error('Graph client not initialized');
    }

    try {
      // Note: This requires specific permissions and may not be available in all tenants
      const response = await this.client
        .api(`/users/${userId}/chats`)
        .filter(`lastUpdatedDateTime ge ${startDate.toISOString()} and lastUpdatedDateTime le ${endDate.toISOString()}`)
        .get();

      return response.value || [];
    } catch (error) {
      console.error('❌ Error fetching chat interactions:', error);
      return [];
    }
  }

  /**
   * Get meeting participation data
   */
  async getMeetingParticipation(userId: string, startDate: Date, endDate: Date): Promise<any[]> {
    if (!this.client) {
      throw new Error('Graph client not initialized');
    }

    try {
      const response = await this.client
        .api(`/users/${userId}/calendar/events`)
        .filter(`start/dateTime ge '${startDate.toISOString()}' and end/dateTime le '${endDate.toISOString()}'`)
        .select('subject,start,end,attendees')
        .get();

      return response.value || [];
    } catch (error) {
      console.error('❌ Error fetching meeting participation:', error);
      return [];
    }
  }

  /**
   * Get shared files/documents
   */
  async getSharedFiles(userId: string): Promise<any[]> {
    if (!this.client) {
      throw new Error('Graph client not initialized');
    }

    try {
      const response = await this.client
        .api(`/users/${userId}/drive/sharedWithMe`)
        .get();

      return response.value || [];
    } catch (error) {
      console.error('❌ Error fetching shared files:', error);
      return [];
    }
  }

  /**
   * Sync collaboration data for all employees
   */
  async syncCollaborationData(employeeIds: string[]): Promise<void> {
    if (!this.client) {
      throw new Error('Graph client not initialized');
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); // Last 30 days

    for (const employeeId of employeeIds) {
      try {
        // Get meeting participation
        const meetings = await this.getMeetingParticipation(employeeId, startDate, endDate);
        
        // Process meetings to extract collaboration data
        for (const meeting of meetings) {
          if (meeting.attendees && meeting.attendees.length > 1) {
            const duration = this.calculateDuration(meeting.start.dateTime, meeting.end.dateTime);
            
            // Record collaboration with each attendee
            for (const attendee of meeting.attendees) {
              if (attendee.emailAddress && attendee.emailAddress.address !== employeeId) {
                // This would need to map email to employee ID
                // await collaborationTracker.recordInteraction(employeeId, attendeeId, 'meeting', 1, duration);
              }
            }
          }
        }

        // Get shared files
        const sharedFiles = await getSharedFiles(employeeId);
        // Process shared files...

      } catch (error) {
        console.error(`❌ Error syncing collaboration data for ${employeeId}:`, error);
      }
    }

    console.log('✅ Collaboration data sync completed');
  }

  /**
   * Calculate meeting duration in minutes
   */
  private calculateDuration(startDateTime: string, endDateTime: string): number {
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  }

  /**
   * Send message via Teams
   */
  async sendTeamsMessage(userId: string, message: string): Promise<void> {
    if (!this.client) {
      throw new Error('Graph client not initialized');
    }

    try {
      // This would use the Teams bot framework
      // For now, it's a placeholder
      console.log(`📧 Would send Teams message to ${userId}: ${message}`);
    } catch (error) {
      console.error('❌ Error sending Teams message:', error);
      throw error;
    }
  }
}

export default new MicrosoftGraphIntegration();

