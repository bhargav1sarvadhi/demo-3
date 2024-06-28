import { I18n } from 'i18n';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

const i18nConfigurations = {
    locales: process.env.APP_LANGUAGES.split(','),
    directory: `${__dirname}/`,
    languageHeaderField: 'lan',
    defaultLocale: process.env.APP_LANGUAGES.split(',')[0],
    autoReload: true,
    updateFiles: false,
};
const i18n = new I18n(i18nConfigurations);

export default i18n;
