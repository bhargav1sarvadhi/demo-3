import { Sequelize } from 'sequelize';
import { sequelize } from '../config/database';
import * as path from 'path';
import { DaynamicImport } from '../utils/dayanamic.import';

const folderPath = path.join(__dirname);
const excludedFiles = ['index.ts'];
const models = DaynamicImport(folderPath, excludedFiles);

const db = {
    sequelize,
    Sequelize,
};
Object.keys(models).forEach((modelName) => {
    const fileName = path.basename(modelName, path.extname(modelName));
    db[fileName] = models[modelName](sequelize);
});
Object.keys(db).forEach(function (modelName) {
    if (db[modelName].associate) {
        db[modelName].associate(db);
    }
});
sequelize.sync();

export { db };
