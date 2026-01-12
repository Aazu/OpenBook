const { CosmosClient } = require("@azure/cosmos");

/**
 * Cosmos DB adapter (very small, coursework-oriented).
 * Env:
 *  COSMOS_CONNECTION_STRING  (or COSMOS_ENDPOINT + COSMOS_KEY)
 *  COSMOS_DB_NAME (default: openbooksdb)
 *  COSMOS_CONTAINER (default: openbooks)
 *
 * Data model:
 *  - Users: { id, type:'user', name, role }
 *  - Posts: { id, type:'post', title, image_url, creator_name, caption, location, people, tags, created_at, status }
 *  - Interactions: { id, type:'like'|'rating'|'comment', postId, userId, ... }
 *  - Meta: { id:'meta', type:'meta', activeUserId }
 */
function getClient(){
  if (process.env.COSMOS_CONNECTION_STRING){
    return new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
  }
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  if (!endpoint || !key) throw new Error("Missing Cosmos config (COSMOS_CONNECTION_STRING or COSMOS_ENDPOINT+COSMOS_KEY)");
  return new CosmosClient({ endpoint, key });
}

async function ensureContainer(){
  const client = getClient();
  const dbName = process.env.COSMOS_DB_NAME || "openbooksdb";
  const containerName = process.env.COSMOS_CONTAINER || "openbooks";
  const { database } = await client.databases.createIfNotExists({ id: dbName });
  const { container } = await database.containers.createIfNotExists({
    id: containerName,
    partitionKey: { kind: "Hash", paths: ["/type"] } // simple partition by item type
  });
  return container;
}

async function upsert(item){
  const c = await ensureContainer();
  await c.items.upsert(item);
}

async function getById(id, type){
  const c = await ensureContainer();
  const { resource } = await c.item(id, type).read().catch(()=>({resource:null}));
  return resource;
}

async function query(q, params=[]){
  const c = await ensureContainer();
  const { resources } = await c.items.query({ query: q, parameters: params }).fetchAll();
  return resources;
}

async function delById(id, type){
  const c = await ensureContainer();
  await c.item(id, type).delete();
}

module.exports = { upsert, getById, query, delById };
