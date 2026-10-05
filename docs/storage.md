# Storage setup (one S3 bucket)

Everything lives in a single bucket. The key prefix decides who can see an object:

| Prefix | Content | Access |
|---|---|---|
| `audio/` | tracks | **private**. Only reachable through a short-lived pre-signed URL the API issues after an access check |
| `covers/` | track covers, program posters | public through a base URL, or signed by the API if you do not set one |

The app never puts audio through the API. The browser uploads straight to S3 with a pre-signed form, and listeners stream straight from S3 with a pre-signed URL (Range requests work, so seeking works).

## 1. Create the bucket

- Pick a region and put it in `AWS_REGION`.
- Keep **Block all public access ON** for the whole bucket if you serve covers through CloudFront (recommended: CloudFront with an origin access control restricted to `covers/*`, base URL in `S3_PUBLIC_BASE_URL`).
- No CloudFront? Leave `S3_PUBLIC_BASE_URL` empty and covers are served with signed URLs (valid 1 hour). It works, but covers cannot be browser-cached across requests.
- Public-prefix alternative: turn off "Block public bucket policies" only, and add:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadCoversOnly",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR_BUCKET/covers/*"
    }
  ]
}
```

  Then set `S3_PUBLIC_BASE_URL=https://YOUR_BUCKET.s3.YOUR_REGION.amazonaws.com`. Never grant public access to `audio/`.

## 2. CORS (the browser talks to S3 directly)

```json
[
  {
    "AllowedOrigins": ["http://localhost:5173", "https://your-production-domain"],
    "AllowedMethods": ["GET", "HEAD", "POST"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Range", "Accept-Ranges"],
    "MaxAgeSeconds": 3000
  }
]
```

`POST` is for uploads, `GET`/`HEAD` with `Range` is for playback.

## 3. IAM user for the API

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::YOUR_BUCKET/*"
    },
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::YOUR_BUCKET"
    }
  ]
}
```

- `PutObject`: needed for pre-signed uploads to succeed (a pre-signed request only has the permissions of the key that signed it).
- `GetObject`: signed downloads, and the `HeadObject` check at upload confirmation.
- `ListBucket`: without it S3 answers **403 instead of 404** for a missing object, and the confirm step would report a permissions error for a file that simply has not arrived yet.

On AWS compute (ECS, EC2) prefer an instance or task role and leave the two key variables empty: the SDK picks the role up by itself.

## 4. Environment

```
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET=your-bucket
S3_PUBLIC_BASE_URL=            # optional, see section 1
S3_SIGNED_URL_TTL_SECONDS=600  # audio download URL lifetime, 60..3600
```

Without `S3_BUCKET` the upload endpoints answer `503 Storage is not configured`; the rest of the API keeps working.

## 5. How an upload works

1. Admin: `POST /admin/media/uploads` with `{ kind, contentType, sizeBytes }`. The API records a `PENDING` asset and returns `{ assetId, upload: { url, fields } }`.
2. Browser: sends `fields` plus the file (as the last form field, named `file`) to `upload.url` as `multipart/form-data`. S3 itself rejects any file whose size differs from the announced one or whose type differs.
3. Admin: `POST /admin/media/uploads/:id/confirm` with `{ durationMs }` (audio only; the browser reads it from the file's metadata). The API checks the stored object, then marks the asset `READY`.
4. Use `assetId` as `audioAssetId` or `coverAssetId` when creating a track, or as `posterAssetId` for a program.

## 6. Quick check once the keys are in

```bash
# log in as the admin, then:
curl -s -X POST localhost:4000/admin/media/uploads \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"kind":"IMAGE","contentType":"image/png","sizeBytes":1000}' | jq
```

You should get an `upload.url` on `*.amazonaws.com` and a `key` starting with `covers/`.

## Known gaps

- Assets that are registered but never uploaded or confirmed stay `PENDING` forever. A cleanup job for stale pending assets is a follow-up.
- Uploaded files are not virus-scanned or transcoded. The API only checks size and declared type.
