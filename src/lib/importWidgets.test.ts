import { describe, expect, it } from 'vitest';
import { parseWidgetsExport } from './importWidgets';

/** Two-widget fixture modelled on the real Xperience export
 *  (`xperience-streaming-fusion-widgets.json`): one `row.classic`
 *  addonCatalog widget and one `collection.row` with embedded tiles. */
const FUSION_EXPORT = {
  exportType: 'fusionWidgets',
  exportVersion: 1,
  widgets: [
    {
      id: 'catalog.recs_movies_for_you',
      title: 'For You',
      type: 'row.classic',
      dataSource: {
        kind: 'addonCatalog',
        payload: {
          addonId: 'https://xperience-app.com/manifest/abc/manifest.json',
          catalogId: 'movie::recs_movies_for_you',
          type: 'movie',
        },
      },
    },
    {
      id: 'collection.0f5de1c5',
      title: 'Streaming',
      type: 'collection.row',
      dataSource: {
        kind: 'collection',
        payload: {
          items: [
            {
              id: '3ced99e7',
              title: 'Netflix',
              hideTitle: true,
              imageAspect: 'wide',
              imageURL: 'https://cdn.example.com/netflix.webp',
              dataSources: [
                {
                  kind: 'addonCatalog',
                  payload: {
                    addonId: 'https://xperience-app.com/manifest/abc/manifest.json',
                    catalogId: 'netflix::all',
                    type: 'movie',
                  },
                },
              ],
            },
            { id: 'tile-without-source', title: 'Disney+', imageAspect: 'poster' },
          ],
        },
      },
    },
  ],
};

describe('parseWidgetsExport — Fusion export', () => {
  it('converts addonCatalog widgets with the style mapping', () => {
    const { widgets, skipped } = parseWidgetsExport(JSON.stringify(FUSION_EXPORT));
    expect(skipped).toEqual([]);
    expect(widgets).toHaveLength(2);

    const forYou = widgets[0];
    expect(forYou.title).toBe('For You');
    expect(forYou.style).toBe('standard');
    expect(forYou.sourceId).toBe('catalog.recs_movies_for_you');
    expect(forYou.dataSource).toEqual({
      kind: 'addonCatalog',
      addonId: 'https://xperience-app.com/manifest/abc/manifest.json',
      catalogId: 'movie::recs_movies_for_you',
      mediaType: 'movie',
    });
  });

  it('maps collection.row onto a Collections Row with entry sources', () => {
    const { widgets } = parseWidgetsExport(JSON.stringify(FUSION_EXPORT));
    const streaming = widgets[1];
    expect(streaming.title).toBe('Streaming');
    expect(streaming.style).toBe('collectionsRow');
    expect(streaming.sourceId).toBe('collection.0f5de1c5');

    const entries = (streaming.dataSource as { kind: string; entries: unknown[] }).entries;
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      id: '3ced99e7',
      title: 'Netflix',
      coverImage: 'https://cdn.example.com/netflix.webp',
      tileShape: 'landscape',
      source: {
        addonCatalog: {
          addonId: 'https://xperience-app.com/manifest/abc/manifest.json',
          catalogId: 'netflix::all',
          mediaType: 'movie',
        },
      },
    });
    // A tile with no convertible source stays a labeled placeholder.
    expect(entries[1]).toEqual({
      id: 'tile-without-source',
      title: 'Disney+',
      tileShape: 'poster',
    });
  });

  it('lists unsupported data source kinds as skipped instead of dropping them', () => {
    const exportWithUnknown = {
      exportType: 'fusionWidgets',
      widgets: [
        { title: 'My Watchlist', type: 'row.classic', dataSource: { kind: 'watchlist', payload: {} } },
      ],
    };
    const { widgets, skipped } = parseWidgetsExport(JSON.stringify(exportWithUnknown));
    expect(widgets).toEqual([]);
    expect(skipped).toEqual(['My Watchlist']);
  });

  it('keeps same-named widgets distinct — identity is the source id', () => {
    const sameNameExport = {
      exportType: 'fusionWidgets',
      widgets: [
        {
          id: 'collection.aaa',
          title: 'Directors',
          type: 'collection.row',
          dataSource: { kind: 'collection', payload: { items: [{ id: 't1', title: 'A', imageAspect: 'wide' }] } },
        },
        {
          id: 'collection.bbb',
          title: 'Directors',
          type: 'collection.row',
          dataSource: { kind: 'collection', payload: { items: [{ id: 't2', title: 'B', imageAspect: 'wide' }] } },
        },
      ],
    };
    const { widgets } = parseWidgetsExport(JSON.stringify(sameNameExport));
    expect(widgets).toHaveLength(2);
    expect(widgets.map((w) => w.sourceId)).toEqual(['collection.aaa', 'collection.bbb']);
  });
});

describe('parseWidgetsExport — native Moonlit export', () => {
  it('normalizes widgets to the import shape (preset rows get their own ids)', () => {
    const native = [
      { id: 'w1', title: 'Popular Movies', style: 'standard', dataSource: { kind: 'filtering', query: 'sort_by=popularity.desc' } },
    ];
    const { widgets, skipped } = parseWidgetsExport(JSON.stringify(native));
    expect(skipped).toEqual([]);
    expect(widgets).toEqual([
      {
        title: 'Popular Movies',
        style: 'standard',
        dataSource: { kind: 'filtering', query: 'sort_by=popularity.desc' },
        sourceId: 'w1',
      },
    ]);
  });
});
