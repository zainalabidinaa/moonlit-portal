import io
import unittest

from PIL import Image

from card_generator.nuvio_tiles import NUVIO_TILE_H, NUVIO_TILE_W, generate_nuvio_tile


class NuvioTileTests(unittest.TestCase):
    def test_generate_nuvio_tile_returns_png_at_expected_size(self):
        png = generate_nuvio_tile(
            title="FOOD",
            subject="chef",
            palette="gold",
            variant="normal",
            brush_x=58,
            text_x=7,
        )

        image = Image.open(io.BytesIO(png))

        self.assertEqual(image.size, (NUVIO_TILE_W, NUVIO_TILE_H))
        self.assertEqual(image.format, "PNG")
        self.assertGreater(len(image.getcolors(maxcolors=1_000_000)), 8)

    def test_generate_nuvio_tile_half_scale_preview(self):
        png = generate_nuvio_tile(
            title="MARTIAL ARTS",
            subject="fighter",
            palette="white",
            variant="focused",
            brush_x=54,
            text_x=7,
            render_scale=0.5,
        )

        image = Image.open(io.BytesIO(png))

        self.assertEqual(image.size, (836, 470))


if __name__ == "__main__":
    unittest.main()
