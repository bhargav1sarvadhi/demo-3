import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../logger/logger';

export const DaynamicImport = (folderPath, excludedFiles) => {
    const importedModules = {};
    const processDirectory = (dirPath) => {
        const items = fs.readdirSync(dirPath);
        items.forEach((item) => {
            const itemPath = path.join(dirPath, item);
            if (fs.lstatSync(itemPath).isDirectory()) {
                const subModules = processDirectory(itemPath);
                Object.assign(importedModules, subModules);
            } else if (item.endsWith('.ts') && !excludedFiles.includes(item)) {
                try {
                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                    const importedModule = require(itemPath);
                    Object.assign(importedModules, importedModule);
                } catch (error) {
                    logger.error(
                        `Error importing module from ${itemPath}: ${error}`,
                    );
                }
            }
        });
        return importedModules;
    };
    return processDirectory(folderPath);
};
