import { Client } from '@notionhq/client';
import { nonNullable, normDate, parseTag } from './util';
import { Event } from '../type';
import { PageObjectResponse, PartialPageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

class NotionAPI {
  client: Client;
  databaseId: string;

  constructor(token: string, databaseId: string) {
    this.client = new Client({
      auth: token,
    });
    this.databaseId = databaseId;
  }

  /**
   * Format event data from Notion API response
   * @param event {PageObjectResponse | PartialPageObjectResponse} Raw event data from Notion API
   * @returns Event | undefined
   */
  formatEvent(event: PageObjectResponse | PartialPageObjectResponse): Event | undefined {
    if (!('properties' in event)) return;
    const id =
      event.properties['Event Id'].type === 'rich_text'
        ? event.properties['Event Id'].rich_text[0]?.plain_text ?? ''
        : '';
    const pageId = event.id;
    const start = normDate(event.properties['Date'].type === 'date' ? event.properties['Date'].date?.start ?? '' : '');
    const end = normDate(event.properties['Date'].type === 'date' ? event.properties['Date'].date?.end ?? '' : '');
    const preTitle = event.properties['Name'].type === 'title' ? event.properties['Name'].title[0].plain_text : '';
    const { tag, title } = parseTag(preTitle);

    return {
      id,
      title,
      tag,
      start,
      end,
      pageId,
    };
  }

  /**
   * Fetch max 100 events within the next 7 days from Notion, with the earliest date first.
   * @returns Event[]
   */
  async getEvents() {
    const { results } = await this.client.databases.query({
      database_id: this.databaseId,
      sorts: [
        {
          property: 'Date',
          direction: 'ascending',
        },
      ],
      page_size: 100,
      filter: {
        and: [
          {
            property: 'Date',
            date: {
              before: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            },
          },
        ],
      },
    });

    const existingEvents = results.map(this.formatEvent);
    return existingEvents.filter(nonNullable);
  }

  /**
   * Find a task with a specific tag
   * @param tag {string | undefined | null} Tag to filter by
   * @returns Event | null
   */
  async getParentByTag(tag: string | undefined | null) {
    if (!tag) return null;

    const { results } = await this.client.databases.query({
      database_id: this.databaseId,
      filter: {
        property: 'Tag',
        rich_text: {
          equals: tag,
        },
      },
    });

    if (results.length === 0) return null;
    return results[0];
  }

  /**
   * Delete events from Notion
   * @param events {Event[]} Events to delete
   */
  async deleteEvents(events: Event[]) {
    await Promise.all(
      events.map(async (event) => {
        if (!event?.pageId) return;
        const response = await this.client.pages.update({
          page_id: event.pageId,
          archived: true,
        });
        return response;
      })
    );
    console.log('Notion: Deletion Finished');
  }

  /**
   * Update events in Notion
   * @param events {Event[]} Events to update
   */
  async updateEvents(events: Event[]) {
    await Promise.all(
      events.map(async (event) => {
        if (!event?.pageId) return;
        const response = await this.client.pages.update({
          page_id: event.pageId ?? '',
          properties: {
            Name: {
              title: [
                {
                  text: {
                    content: event.title,
                  },
                },
              ],
            },
            ...(event.start && event.end
              ? {
                  Date: {
                    date: {
                      start: event.start,
                      end: event.end,
                    },
                  },
                }
              : {}),
            'Event Id': {
              rich_text: [
                {
                  text: {
                    content: event.id,
                  },
                },
              ],
            },
          },
        });
        return response;
      })
    );
    console.log('Notion: Update Finished');
  }

  /**
   * Create events in Notion
   * @param events {Event[]} Events to create
   * @returns Event[] Created events
   */
  async createEvents(events: Event[]) {
    const res = await Promise.all(
      events.map(async (event) => {
        const parent = await this.getParentByTag(event?.tag);
        const response = await this.client.pages.create({
          parent: { database_id: this.databaseId },
          properties: {
            Name: {
              title: [
                {
                  text: {
                    content: event.title,
                  },
                },
              ],
            },
            ...(event.start && event.end
              ? {
                  Date: {
                    date: {
                      start: event.start,
                      end: event.end,
                    },
                  },
                }
              : {}),
            'Event Id': {
              rich_text: [
                {
                  text: {
                    content: event.id,
                  },
                },
              ],
            },
            'Parent Item': {
              relation: parent
                ? [
                    {
                      id: parent.id,
                    },
                  ]
                : [],
            },
          },
        });
        return response;
      })
    );
    console.log('Notion: Creation Finished');
    return res.map(this.formatEvent).filter(nonNullable);
  }
}

export default NotionAPI;
