import { translate, type Locale, type MessageKey, type Params } from '../i18n';

/**
 * A user-facing validation problem, carried as a message key so the form can show it in the visitor's
 * language. `message` is the English text (for logs and tests). `fieldKey` names the form field for
 * messages with a `{field}` placeholder ("Amount: enter an amount like 450") and is translated too.
 */
export class UserError extends Error {
	readonly key: MessageKey;
	readonly params: Params;
	readonly fieldKey: MessageKey | undefined;

	constructor(key: MessageKey, params: Params = {}, fieldKey?: MessageKey) {
		super();
		this.key = key;
		this.params = params;
		this.fieldKey = fieldKey;
		this.message = this.localized('en');
	}

	localized(locale: Locale): string {
		const params = this.fieldKey
			? { ...this.params, field: translate(locale, this.fieldKey) }
			: this.params;
		return translate(locale, this.key, params);
	}
}
