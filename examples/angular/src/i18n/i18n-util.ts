// This file was auto-generated by 'typesafe-i18n'. Any manual changes will be overwritten.
/* eslint-disable */

import { i18nString as initI18nString, i18nObjectLoaderAsync } from 'typesafe-i18n'
import type { Translation, TranslationFunctions, Formatters, Locales } from './i18n-types'
import type { LocaleDetector } from 'typesafe-i18n/detectors'
import { detectLocale as detectLocaleFn } from 'typesafe-i18n/detectors'
import { initFormatters } from './formatters'

export const baseLocale: Locales = 'en'

export const locales: Locales[] = [
	'de',
	'en',
	'it'
]

const localeTranslationLoaders = {
	de: () => import('./de'),
	en: () => import('./en'),
	it: () => import('./it'),
}

export const getTranslationForLocale = async (locale: Locales) => (await (localeTranslationLoaders[locale] || localeTranslationLoaders[baseLocale])()).default as Translation

export const i18nObject = (locale: Locales) => i18nObjectLoaderAsync<Locales, Translation, TranslationFunctions, Formatters>(locale, getTranslationForLocale, initFormatters)

export const i18nString = async (locale: Locales) => initI18nString<Locales, Formatters>(locale, await initFormatters(locale))

export const detectLocale = (...detectors: LocaleDetector[]) => detectLocaleFn<Locales>(baseLocale, locales, ...detectors)