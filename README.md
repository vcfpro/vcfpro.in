# vcfpro.in

Source code for the VCF PRO website and administration panel.

## Structure

- `frontend/`: React, TypeScript, Vite, Tailwind CSS, and TipTap frontend.
- `public_html/api/`: PHP API router deployed under the web root.
- `public_html/uploads/`: protected runtime upload directory (media is ignored).
- `scripts/`: behavioral and full-regression checks.
- `deploy.ps1`: uploads explicitly listed build files over FTP.

## Frontend

```powershell
cd frontend
npm ci
npm run build
```

The generated `frontend/dist/` contents are deployed into `public_html/`.
Generated bundles are intentionally not committed.

## Runtime configuration

The API expects these files outside `public_html/` on the server:

- `vcfpro-config.php` containing the JWT secret.
- `vcfpro-data/database.sqlite` containing application data.

Credentials, databases, uploaded media, and generated production assets are
excluded from version control.
