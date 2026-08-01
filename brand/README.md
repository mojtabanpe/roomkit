# Brand assets

`roomkit-logo.png` is the master lockup (mark above the روم‌کیت wordmark).
Everything the app ships is derived from it — do not hand-edit the derived
files, regenerate them:

```bash
python3 tools/build-logo-assets.py
```

| Derived file (`apps/web/public/`) | Cut from                        | Used by                       |
| --------------------------------- | ------------------------------- | ----------------------------- |
| `logo-mark.png`                    | mark only                       | `app-logo` mark, apple-touch  |
| `logo-wordmark.png`                | wordmark only                   | `app-logo` wordmark           |
| `favicon-64.png`                   | mark, padded square             | browser tab icon              |

The pieces are split so the same artwork works stacked (as drawn) *and*
horizontally in tight bars like the room header, where a stacked lockup would
render the wordmark illegibly small.
