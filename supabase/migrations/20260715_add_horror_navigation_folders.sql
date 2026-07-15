-- Keep the supplied category order at the start of Genres → Horror, followed by
-- the existing media entries already configured for that folder.
DO $$
DECLARE
  horror_id uuid := 'b5f8b764-7e4b-480a-9c31-1388e0e6c606';
  horror_collection_id uuid := '861c4a7a-74d5-4cb8-ae0b-a0641d07043e';
  child record;
  child_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.folders
    WHERE id = horror_id
      AND collection_id = horror_collection_id
      AND name = 'Horror'
  ) THEN
    RAISE EXCEPTION 'Expected Genres → Horror folder is missing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.folders
    WHERE parent_folder_id = horror_id
      AND name = 'Horror Franchises'
  ) THEN
    RETURN;
  END IF;

  -- Move existing media entries out of the first five positions safely.
  UPDATE public.folder_entries
  SET sort_order = sort_order + 1000
  WHERE parent_folder_id = horror_id;

  FOR child IN
    SELECT * FROM (VALUES
      ('Horror Franchises', 0),
      ('International Horror', 1),
      ('Horror Mood & Vibe', 2),
      ('Horror Decades', 3),
      ('Horror genre', 4)
    ) AS categories(name, sort_order)
    ORDER BY sort_order
  LOOP
    INSERT INTO public.folders (
      collection_id, parent_folder_id, name, sort_order, tile_shape, enabled
    ) VALUES (
      horror_collection_id, horror_id, child.name, child.sort_order, 'landscape', true
    )
    RETURNING id INTO child_id;

    INSERT INTO public.folder_entries (
      parent_folder_id, entry_kind, folder_id, sort_order
    ) VALUES (
      horror_id, 'folder', child_id, child.sort_order
    );
  END LOOP;

  UPDATE public.folder_entries
  SET sort_order = sort_order - 995
  WHERE parent_folder_id = horror_id
    AND sort_order >= 1000;
END $$;
