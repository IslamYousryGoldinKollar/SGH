/**
 * Firestore security-rules tests for the Culture Capsule (capsule_sessions + crews).
 * Runs against the local emulator (needs Java). From the repo root:
 *
 *   npm i --no-save --legacy-peer-deps @firebase/rules-unit-testing firebase-tools
 *   npx firebase emulators:exec --config firebase.rules-test.json --only firestore \
 *     --project demo-capsule "node scripts/capsule-rules.test.mjs"
 */
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, setDoc, addDoc, collection, updateDoc, deleteDoc, getDoc, getDocs, serverTimestamp } from 'firebase/firestore';

const env = await initializeTestEnvironment({ projectId: 'demo-capsule', firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8089 } });
const photo = 'data:image/jpeg;base64,' + 'A'.repeat(200000);
const good = (over = {}) => ({ leaderName: 'Omar', crewName: 'Navigators', answers: ['a', 'b', 'c', 'd'], photo, createdAt: serverTimestamp(), ...over });
let pass = 0, fail = 0;
const check = async (name, p) => { try { await p; pass++; console.log('ok  ', name); } catch (e) { fail++; console.log('FAIL', name, '-', String(e.message).split('\n')[0]); } };

const admin = env.authenticatedContext('admin1').firestore();
const other = env.authenticatedContext('someone').firestore();
const anon = env.unauthenticatedContext().firestore(); // a leader's phone: not signed in

await check('admin creates own session', assertSucceeds(setDoc(doc(admin, 'capsule_sessions/S1'), { title: 't', adminId: 'admin1', status: 'open', questions: ['1','2','3','4'], expectedCrews: 25 })));
await check('admin cannot create session for someone else', assertFails(setDoc(doc(admin, 'capsule_sessions/S2'), { title: 't', adminId: 'other', status: 'open' })));
await check('anonymous cannot create a session', assertFails(setDoc(doc(anon, 'capsule_sessions/S3'), { title: 't', adminId: 'x', status: 'open' })));
await check('public can read session', assertSucceeds(getDoc(doc(anon, 'capsule_sessions/S1'))));

await check('unsigned phone submits a valid crew', assertSucceeds(addDoc(collection(anon, 'capsule_sessions/S1/crews'), good())));
await check('crew with wrong createdAt rejected', assertFails(addDoc(collection(anon, 'capsule_sessions/S1/crews'), good({ createdAt: new Date('2020-01-01') }))));
await check('crew with 3 answers rejected (needs 4)', assertFails(addDoc(collection(anon, 'capsule_sessions/S1/crews'), good({ answers: ['a', 'b', 'c'] }))));
await check('crew with 5 answers rejected', assertFails(addDoc(collection(anon, 'capsule_sessions/S1/crews'), good({ answers: ['a', 'b', 'c', 'd', 'e'] }))));
await check('crew with empty answer rejected', assertFails(addDoc(collection(anon, 'capsule_sessions/S1/crews'), good({ answers: ['a', '', 'c', 'd'] }))));
await check('crew with 401-char answer rejected', assertFails(addDoc(collection(anon, 'capsule_sessions/S1/crews'), good({ answers: ['a', 'x'.repeat(401), 'c', 'd'] }))));
await check('crew with 240-char answers accepted', assertSucceeds(addDoc(collection(anon, 'capsule_sessions/S1/crews'), good({ answers: ['w'.repeat(240), 'x'.repeat(240), 'y'.repeat(240), 'z'.repeat(240)] }))));
await check('crew with extra field rejected', assertFails(addDoc(collection(anon, 'capsule_sessions/S1/crews'), good({ isAdmin: true }))));
await check('crew with huge photo rejected', assertFails(addDoc(collection(anon, 'capsule_sessions/S1/crews'), good({ photo: 'A'.repeat(700001) }))));
await check('crew without photo rejected', assertFails(addDoc(collection(anon, 'capsule_sessions/S1/crews'), good({ photo: '' }))));
await check('crew with empty leader name rejected', assertFails(addDoc(collection(anon, 'capsule_sessions/S1/crews'), good({ leaderName: '' }))));
await check('empty crew name allowed (optional)', assertSucceeds(addDoc(collection(anon, 'capsule_sessions/S1/crews'), good({ crewName: '' }))));
await check('submitting to a missing session rejected', assertFails(addDoc(collection(anon, 'capsule_sessions/NOPE/crews'), good())));

let crewId;
await env.withSecurityRulesDisabled(async (ctx) => { const r = await addDoc(collection(ctx.firestore(), 'capsule_sessions/S1/crews'), { ...good(), createdAt: new Date() }); crewId = r.id; });
await check('public can read crews', assertSucceeds(getDocs(collection(anon, 'capsule_sessions/S1/crews'))));
await check('crew is immutable (phone)', assertFails(updateDoc(doc(anon, `capsule_sessions/S1/crews/${crewId}`), { leaderName: 'Hacked' })));
await check('crew is immutable (even owner)', assertFails(updateDoc(doc(admin, `capsule_sessions/S1/crews/${crewId}`), { leaderName: 'Edited' })));
await check('phone cannot delete a crew', assertFails(deleteDoc(doc(anon, `capsule_sessions/S1/crews/${crewId}`))));
await check('other admin cannot delete a crew', assertFails(deleteDoc(doc(other, `capsule_sessions/S1/crews/${crewId}`))));

await check('owner saves constitution + themes', assertSucceeds(updateDoc(doc(admin, 'capsule_sessions/S1'), { constitution: { title: 'x', articles: [] }, themes: { byQuestion: [] } })));
await check('owner closes session', assertSucceeds(updateDoc(doc(admin, 'capsule_sessions/S1'), { status: 'closed' })));
await check('phone cannot update the session', assertFails(updateDoc(doc(anon, 'capsule_sessions/S1'), { status: 'open' })));
await check('other admin cannot update the session', assertFails(updateDoc(doc(other, 'capsule_sessions/S1'), { constitution: null })));
await check('owner cannot hand the session to someone else', assertFails(updateDoc(doc(admin, 'capsule_sessions/S1'), { adminId: 'other' })));
await check('closed session rejects new crews', assertFails(addDoc(collection(anon, 'capsule_sessions/S1/crews'), good())));
await check('owner reopens', assertSucceeds(updateDoc(doc(admin, 'capsule_sessions/S1'), { status: 'open' })));
await check('owner deletes a crew', assertSucceeds(deleteDoc(doc(admin, `capsule_sessions/S1/crews/${crewId}`))));
await check('other admin cannot delete session', assertFails(deleteDoc(doc(other, 'capsule_sessions/S1'))));
await check('owner deletes session', assertSucceeds(deleteDoc(doc(admin, 'capsule_sessions/S1'))));

console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup();
process.exit(fail ? 1 : 0);
