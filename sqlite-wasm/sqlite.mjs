import { default as sqlite3InitModule } from './sqlite3-bundler-friendly.mjs';
import _ from './sqlite3-worker1-promiser.mjs';

const sqlite3Worker1Promiser = self.sqlite3Worker1Promiser;
const __ = _; // so t348 will not erase the import

export default sqlite3InitModule;
export { sqlite3Worker1Promiser };
