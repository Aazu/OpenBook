OpenBooks — REST Backend + Static Frontend (Windows)

Requirements:
- Node.js (LTS) installed
  Test: node -v
  Test: npm -v

Run the project (CMD):
1) Extract the ZIP
2) Open Command Prompt in the folder "server"
3) Install dependencies:
   npm install
4) Start server:
   npm start
5) Open in browser:
   http://localhost:3000/

What works:
- Consumer Portal: browse/search/sort, open photo, like/rate/comment
- Creator Console: upload image + metadata (title, caption, location, people, tags)
- Admin Console: add/delete users, publish/unpublish, delete posts, reset DB
- Settings/Profile: switch active user + edit name/role
- Tech Status: server status + export/reset

Notes:
- This is a coursework-friendly demo implementation:
  * REST API provides service logic and persistence.
  * Persistence uses a JSON file database (server/data/db.json).
  * Images are stored on disk in server/uploads/ and served at /uploads/...

Cloud next step:
- Replace JSON DB with managed DB (Cosmos/Postgres/Dynamo).
- Replace disk uploads with object storage (Azure Blob / S3).
- Add auth (JWT/OAuth) + roles.
- Add CDN caching + DNS routing.
