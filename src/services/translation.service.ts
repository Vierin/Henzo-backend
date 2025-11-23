import { Injectable } from '@nestjs/common';

@Injectable()
export class TranslationService {
  /**
   * Detect language of text
   */
  detectLanguage(text: string): 'en' | 'vi' | 'ru' {
    if (!text || !text.trim()) {
      return 'en'; // default
    }

    // Check for Vietnamese characters
    const vietnameseChars =
      /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
    if (vietnameseChars.test(text)) {
      return 'vi';
    }

    // Check for Cyrillic characters (Russian)
    const cyrillicChars = /[а-яё]/i;
    if (cyrillicChars.test(text)) {
      return 'ru';
    }

    // Default to English
    return 'en';
  }

  /**
   * Translate text using Google Translate API
   * Note: Requires GOOGLE_TRANSLATE_API_KEY environment variable
   */
  async translateText(
    text: string,
    targetLanguage: 'en' | 'vi' | 'ru',
    sourceLanguage: 'en' | 'vi' | 'ru' = 'ru',
  ): Promise<string> {
    if (!text || !text.trim()) {
      return '';
    }

    // If source and target are the same, return original text
    if (sourceLanguage === targetLanguage) {
      return text;
    }

    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;

    if (!apiKey) {
      console.warn('GOOGLE_TRANSLATE_API_KEY not set, returning original text');
      return text;
    }

    try {
      const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
      const requestBody = {
        q: text,
        source: sourceLanguage,
        target: targetLanguage,
        format: 'text',
      };

      console.log(
        `[Translation] Translating from ${sourceLanguage} to ${targetLanguage}: "${text.substring(0, 50)}..."`,
      );

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { raw: errorText };
        }
        console.error(
          `[Translation] API error (${response.status}):`,
          JSON.stringify(errorData, null, 2),
        );
        throw new Error(
          `Translation failed: ${errorData.error?.message || response.statusText}`,
        );
      }

      const data = await response.json();
      const translatedText =
        data.data?.translations?.[0]?.translatedText || text;

      console.log(
        `[Translation] Result: "${text.substring(0, 30)}..." -> "${translatedText.substring(0, 30)}..."`,
      );

      return translatedText;
    } catch (error) {
      console.error('[Translation] Error:', error);
      // Return original text on error
      return text;
    }
  }

  /**
   * Generate translations for service name and description
   * Automatically detects the language of name and description
   */
  async generateServiceTranslations(
    name: string,
    description: string,
    sourceLanguage?: 'en' | 'vi' | 'ru',
  ): Promise<{
    nameEn: string;
    nameVi: string;
    nameRu: string;
    descriptionEn: string;
    descriptionVi: string;
    descriptionRu: string;
  }> {
    const languages: Array<'en' | 'vi' | 'ru'> = ['en', 'vi', 'ru'];
    const translations: {
      nameEn: string;
      nameVi: string;
      nameRu: string;
      descriptionEn: string;
      descriptionVi: string;
      descriptionRu: string;
    } = {
      nameEn: '',
      nameVi: '',
      nameRu: '',
      descriptionEn: '',
      descriptionVi: '',
      descriptionRu: '',
    };

    // Auto-detect language if not provided
    const nameLanguage = sourceLanguage || this.detectLanguage(name);
    const descriptionLanguage = description
      ? this.detectLanguage(description)
      : nameLanguage;

    console.log(
      `[Translation] Detected languages - Name: ${nameLanguage}, Description: ${descriptionLanguage}`,
    );

    // Set source language values for name
    if (nameLanguage === 'ru') {
      translations.nameRu = name;
    } else if (nameLanguage === 'en') {
      translations.nameEn = name;
    } else if (nameLanguage === 'vi') {
      translations.nameVi = name;
    }

    // Set source language values for description
    if (description && description.trim()) {
      if (descriptionLanguage === 'ru') {
        translations.descriptionRu = description;
      } else if (descriptionLanguage === 'en') {
        translations.descriptionEn = description;
      } else if (descriptionLanguage === 'vi') {
        translations.descriptionVi = description;
      }
    }

    // Translate to other languages
    const translationPromises: Promise<void>[] = [];

    // Translate name to other languages
    for (const lang of languages) {
      if (lang === nameLanguage) continue;

      translationPromises.push(
        this.translateText(name, lang, nameLanguage).then((translated) => {
          if (lang === 'en') translations.nameEn = translated;
          else if (lang === 'vi') translations.nameVi = translated;
          else if (lang === 'ru') translations.nameRu = translated;
        }),
      );
    }

    // Translate description to other languages
    if (description && description.trim()) {
      for (const lang of languages) {
        if (lang === descriptionLanguage) continue;

        translationPromises.push(
          this.translateText(description, lang, descriptionLanguage).then(
            (translated) => {
              if (lang === 'en') translations.descriptionEn = translated;
              else if (lang === 'vi') translations.descriptionVi = translated;
              else if (lang === 'ru') translations.descriptionRu = translated;
            },
          ),
        );
      }
    }

    await Promise.all(translationPromises);

    return translations;
  }

  /**
   * Generate translations for salon description
   * Automatically detects the language and translates to other languages
   */
  async generateDescriptionTranslations(description: string): Promise<{
    descriptionEn: string;
    descriptionVi: string;
    descriptionRu: string;
  }> {
    if (!description || !description.trim()) {
      return {
        descriptionEn: '',
        descriptionVi: '',
        descriptionRu: '',
      };
    }

    // Detect language
    const sourceLanguage = this.detectLanguage(description);
    const languages: Array<'en' | 'vi' | 'ru'> = ['en', 'vi', 'ru'];

    const translations: {
      descriptionEn: string;
      descriptionVi: string;
      descriptionRu: string;
    } = {
      descriptionEn: '',
      descriptionVi: '',
      descriptionRu: '',
    };

    // Set source language value
    if (sourceLanguage === 'ru') {
      translations.descriptionRu = description;
    } else if (sourceLanguage === 'en') {
      translations.descriptionEn = description;
    } else if (sourceLanguage === 'vi') {
      translations.descriptionVi = description;
    }

    console.log(
      `[Translation] Detected language for description: ${sourceLanguage}`,
    );

    // Translate to other languages
    const translationPromises: Promise<void>[] = [];

    for (const lang of languages) {
      if (lang === sourceLanguage) continue;

      translationPromises.push(
        this.translateText(description, lang, sourceLanguage).then(
          (translated) => {
            if (lang === 'en') translations.descriptionEn = translated;
            else if (lang === 'vi') translations.descriptionVi = translated;
            else if (lang === 'ru') translations.descriptionRu = translated;
          },
        ),
      );
    }

    await Promise.all(translationPromises);

    return translations;
  }
}
