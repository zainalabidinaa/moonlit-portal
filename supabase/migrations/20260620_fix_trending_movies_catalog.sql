-- Fix Trending Movies folder to use trakt.trending.movies instead of tmdb.trending_movie.
-- The AIO Metadata addon's TMDB trending/popular endpoints all return identical results
-- (server-side regression). Trakt catalogs from the same addon return genuinely distinct content.
DELETE FROM folder_catalogs
WHERE folder_id = '0002d068-90bd-46e7-81cb-1a046ccc33cd';

INSERT INTO folder_catalogs (folder_id, catalog_id, media_type, genre)
VALUES ('0002d068-90bd-46e7-81cb-1a046ccc33cd', 'trakt.trending.movies', 'movie', 'None');
