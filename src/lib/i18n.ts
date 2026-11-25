/**
 * Lightweight translations: English, Bahasa Melayu and Simplified Chinese.
 *
 * No library: messages are plain objects and `{name}` placeholders are filled in by `translate`.
 * English defines the keys; the other locales are typed against it, so a missing key fails
 * `svelte-check`, and `i18n.spec.ts` checks the same at runtime (plus matching placeholders).
 * Stored data (charge descriptions, names, reasons) is shown as entered and never translated.
 */

export const LOCALES = ['en', 'ms', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'bs_locale';

/** Each language named in itself, for the picker. */
export const LOCALE_NAMES: Record<Locale, string> = {
	en: 'English',
	ms: 'Bahasa Melayu',
	zh: '简体中文'
};
/** Short picker labels. */
export const LOCALE_SHORT: Record<Locale, string> = { en: 'EN', ms: 'BM', zh: '中文' };
/** Values for `<html lang>`. */
export const HTML_LANG: Record<Locale, string> = { en: 'en', ms: 'ms', zh: 'zh-Hans' };

const en = {
	'locale.label': 'Language',
	'nav.main': 'Main',
	'nav.dashboard': 'Dashboard',
	'nav.properties': 'Properties',
	'nav.tenants': 'Tenants',
	'nav.billing': 'Billing',
	'nav.meters': 'Meters',
	'nav.reminders': 'Reminders',
	'nav.export': 'Export',
	'common.signOut': 'Sign out',
	'common.bed': 'Bed {label}',
	'common.day': '{n} day',
	'common.days': '{n} days',
	'common.movedOut': 'Moved out {date}',
	'common.print': 'Print / save as PDF',
	'common.tenant': 'Tenant',
	'common.landlord': 'Landlord',
	'footer.app': 'Demo data is synthetic. Today in Malaysia: {today}',
	'footer.portal':
		'Read-only view of your own account. Questions about a charge? Ask your landlord. Today in Malaysia: {today}',

	'login.title': 'Sign in',
	'login.intro': 'Room & bed rental for landlords and their tenants. Sign in to continue.',
	'login.email': 'Email',
	'login.password': 'Password',
	'login.submit': 'Sign in',
	'login.demoAccounts': 'Demo accounts (synthetic data):',
	'login.publicDemo':
		'This is a public demo. Anyone can change the data, and it goes back to the sample data every hour.',
	'login.wrong': 'Wrong email or password',
	'login.tooMany': 'Too many failed sign-ins. Try again in {minutes} min.',

	'invite.title': 'Tenant invite',
	'invite.heading': 'biliksewa tenant portal',
	'invite.intro':
		'{landlord} invited {tenant} to see their rent, bills and payments online. Choose a password to finish.',
	'invite.confirm': 'Confirm password',
	'invite.submit': 'Create my account',
	'invite.expires': 'This link works once and expires on {date}.',
	'invite.invalid':
		'This invite link is not valid. It may have been used already or expired. Ask your landlord for a new link.',
	'invite.goSignIn': 'Go to sign in',

	'portal.title': 'My rent',
	'portal.back': '← My rent',
	'portal.hi': 'Hi, {name}',
	'portal.intro': 'Your rent, shared bills and payments.',
	'portal.stayAt': 'Stay at {property}',
	'portal.staying': 'Staying',
	'portal.details':
		'{area} · {room} · {bed} · since {start} · {rent}/month · deposit {deposit} · landlord {landlord}',
	'portal.balanceGroup': 'Balance',
	'portal.billed': 'Billed',
	'portal.paid': 'Paid',
	'portal.balance': 'Balance',
	'portal.overdue': '{amount} overdue',
	'portal.nothingOverdue': 'Nothing overdue',
	'portal.statement': 'Monthly statement',
	'portal.statementFor': 'Monthly statement for {property}',
	'portal.noTenancy': 'No tenancy is linked to this account yet.',
	'portal.readingSent': 'Reading of {kwh} sent to your landlord',

	'col.due': 'Due',
	'col.date': 'Date',
	'col.description': 'Description',
	'col.amount': 'Amount',
	'col.unpaid': 'Unpaid',
	'col.paidOn': 'Paid on',
	'col.method': 'Method',
	'col.reference': 'Reference',
	'col.receipt': 'Receipt',
	'col.charge': 'Charge',
	'col.payment': 'Payment',
	'col.balance': 'Balance',
	'col.daysOverdue': 'Days overdue',
	'col.readOn': 'Read on',
	'col.reading': 'Reading',
	'col.status': 'Status',
	'col.yourShare': 'Your share',

	'ledger.charges': 'Charges',
	'ledger.payments': 'Payments',
	'ledger.paid': 'Paid',
	'ledger.noCharges': 'No charges yet.',
	'ledger.noPayments': 'No payments yet.',
	'receipt.link': 'Receipt',
	'receipt.linkLabel': 'Receipt for {amount} paid on {date}',
	'method.cash': 'Cash',
	'method.bank_transfer': 'Bank transfer',
	'method.other': 'Other',
	'method.deposit': 'From deposit',

	'meter.heading': 'Electricity meter (your room)',
	'meter.billedAt': 'Billed at {rate}.',
	'meter.lastConfirmed': 'Last confirmed reading: {kwh} on {date}.',
	'meter.noConfirmed': 'No confirmed reading yet.',
	'meter.waiting': 'A reading for your room is waiting for the landlord to check it.',
	'meter.reading': 'Reading (kWh)',
	'meter.photo': 'Photo (optional)',
	'meter.send': 'Send reading',
	'meter.resized': 'Photo resized to {kb} KB.',
	'meter.tooLarge':
		'This photo is too large (max 300 KB). Try a smaller one, or send without a photo.',
	'meter.photoLink': 'photo',
	'meter.status.pending': 'Waiting',
	'meter.status.confirmed': 'Confirmed',
	'meter.status.rejected': 'Rejected',
	'meter.reason': 'Reason: {reason}',
	'meter.opening': 'Opening reading',
	'meter.used': '{kwh} used by the room',

	'deposit.heading': 'Deposit settled on {date}',
	'deposit.held': 'Deposit held',
	'deposit.deduction': 'Deduction: {label}',
	'deposit.unpaid': 'Unpaid rent and bills',
	'deposit.refund': 'Refund',
	'deposit.refundedBy': 'Refunded by {method}.',
	'deposit.refundedByRef': 'Refunded by {method} (ref {ref}).',

	'statement.pageTitle': 'Statement {period}',
	'statement.monthNav': 'Statement month',
	'statement.month': 'Month',
	'statement.show': 'Show',
	'statement.download': 'Download (HTML)',
	'statement.title': 'Monthly statement {period}',
	'statement.landlordLine': 'Landlord {landlord} · rent {rent}/month',
	'statement.carried': 'Balance carried forward',
	'statement.brought': 'Balance brought forward',
	'statement.empty': 'No charges or payments this month.',
	'statement.note':
		"Charges are listed by billing month and payments by the date paid. A negative balance is credit in the tenant's favour. This statement is not a tax invoice.",
	'statement.generated': 'generated {date}',
	'statement.bedLabel': 'Bed',
	'statement.monthlyRent': 'Monthly rent',

	'receipt.pageTitle': 'Receipt {number}',
	'receipt.title': 'Payment receipt',
	'receipt.from': 'Received from',
	'receipt.for': 'For',
	'receipt.note':
		'Recorded by the landlord in biliksewa. This is an acknowledgement of payment, not a tax invoice.',

	'reminders.title': 'Overdue reminders',
	'reminders.intro':
		'Who owes what as of {today}. Copy a message into WhatsApp, SMS or email yourself: biliksewa never sends anything.',
	'reminders.summary': 'Overdue summary',
	'reminders.total': 'Overdue in total',
	'reminders.count': 'Tenants overdue',
	'reminders.since': '{days} overdue (since {date})',
	'reminders.messageLang': 'Message language',
	'reminders.messageFor': 'Reminder message for {name}',
	'reminders.copy': 'Copy message',
	'reminders.statement': 'Statement',
	'reminders.copied': 'Copied',
	'reminders.none': 'Nobody is overdue. 🎉',

	'reminder.greeting': 'Hi {tenant}, this is a friendly reminder from {landlord} about {where}.',
	'reminder.asOf': 'As of {today}, {total} is overdue:',
	'reminder.item': '- {description} (due {due}): {amount}, {days} overdue',
	'reminder.closing':
		'Please pay when you can and send me the transfer reference. If you have already paid, please ignore this message. Thank you!'
} as const satisfies Record<string, string>;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;

const ms: Messages = {
	'locale.label': 'Bahasa',
	'nav.main': 'Utama',
	'nav.dashboard': 'Papan pemuka',
	'nav.properties': 'Hartanah',
	'nav.tenants': 'Penyewa',
	'nav.billing': 'Bil',
	'nav.meters': 'Meter',
	'nav.reminders': 'Peringatan',
	'nav.export': 'Eksport',
	'common.signOut': 'Log keluar',
	'common.bed': 'Katil {label}',
	'common.day': '{n} hari',
	'common.days': '{n} hari',
	'common.movedOut': 'Keluar {date}',
	'common.print': 'Cetak / simpan sebagai PDF',
	'common.tenant': 'Penyewa',
	'common.landlord': 'Tuan rumah',
	'footer.app': 'Data demo adalah sintetik. Hari ini di Malaysia: {today}',
	'footer.portal':
		'Paparan baca sahaja untuk akaun anda sendiri. Ada soalan tentang sesuatu caj? Tanya tuan rumah anda. Hari ini di Malaysia: {today}',

	'login.title': 'Log masuk',
	'login.intro':
		'Sewa bilik & katil untuk tuan rumah dan penyewa mereka. Log masuk untuk meneruskan.',
	'login.email': 'E-mel',
	'login.password': 'Kata laluan',
	'login.submit': 'Log masuk',
	'login.demoAccounts': 'Akaun demo (data sintetik):',
	'login.publicDemo':
		'Ini demo awam. Sesiapa sahaja boleh menukar data, dan data kembali kepada data contoh setiap jam.',
	'login.wrong': 'E-mel atau kata laluan salah',
	'login.tooMany': 'Terlalu banyak cubaan log masuk. Cuba lagi dalam {minutes} minit.',

	'invite.title': 'Jemputan penyewa',
	'invite.heading': 'Portal penyewa biliksewa',
	'invite.intro':
		'{landlord} menjemput {tenant} untuk melihat sewa, bil dan bayaran secara dalam talian. Pilih kata laluan untuk selesai.',
	'invite.confirm': 'Sahkan kata laluan',
	'invite.submit': 'Cipta akaun saya',
	'invite.expires': 'Pautan ini boleh digunakan sekali sahaja dan tamat pada {date}.',
	'invite.invalid':
		'Pautan jemputan ini tidak sah. Mungkin sudah digunakan atau telah tamat. Minta pautan baharu daripada tuan rumah anda.',
	'invite.goSignIn': 'Pergi ke log masuk',

	'portal.title': 'Sewa saya',
	'portal.back': '← Sewa saya',
	'portal.hi': 'Hai, {name}',
	'portal.intro': 'Sewa, bil kongsi dan bayaran anda.',
	'portal.stayAt': 'Penginapan di {property}',
	'portal.staying': 'Sedang menginap',
	'portal.details':
		'{area} · {room} · {bed} · sejak {start} · {rent}/bulan · deposit {deposit} · tuan rumah {landlord}',
	'portal.balanceGroup': 'Baki',
	'portal.billed': 'Dibilkan',
	'portal.paid': 'Dibayar',
	'portal.balance': 'Baki',
	'portal.overdue': '{amount} tertunggak',
	'portal.nothingOverdue': 'Tiada tunggakan',
	'portal.statement': 'Penyata bulanan',
	'portal.statementFor': 'Penyata bulanan untuk {property}',
	'portal.noTenancy': 'Belum ada penyewaan yang dipautkan kepada akaun ini.',
	'portal.readingSent': 'Bacaan {kwh} telah dihantar kepada tuan rumah anda',

	'col.due': 'Tarikh akhir',
	'col.date': 'Tarikh',
	'col.description': 'Keterangan',
	'col.amount': 'Jumlah',
	'col.unpaid': 'Belum dibayar',
	'col.paidOn': 'Dibayar pada',
	'col.method': 'Kaedah',
	'col.reference': 'Rujukan',
	'col.receipt': 'Resit',
	'col.charge': 'Caj',
	'col.payment': 'Bayaran',
	'col.balance': 'Baki',
	'col.daysOverdue': 'Hari tertunggak',
	'col.readOn': 'Dibaca pada',
	'col.reading': 'Bacaan',
	'col.status': 'Status',
	'col.yourShare': 'Bahagian anda',

	'ledger.charges': 'Caj',
	'ledger.payments': 'Bayaran',
	'ledger.paid': 'Dibayar',
	'ledger.noCharges': 'Belum ada caj.',
	'ledger.noPayments': 'Belum ada bayaran.',
	'receipt.link': 'Resit',
	'receipt.linkLabel': 'Resit untuk {amount} dibayar pada {date}',
	'method.cash': 'Tunai',
	'method.bank_transfer': 'Pindahan bank',
	'method.other': 'Lain-lain',
	'method.deposit': 'Daripada deposit',

	'meter.heading': 'Meter elektrik (bilik anda)',
	'meter.billedAt': 'Dibilkan pada {rate}.',
	'meter.lastConfirmed': 'Bacaan terakhir yang disahkan: {kwh} pada {date}.',
	'meter.noConfirmed': 'Belum ada bacaan yang disahkan.',
	'meter.waiting': 'Satu bacaan untuk bilik anda sedang menunggu semakan tuan rumah.',
	'meter.reading': 'Bacaan (kWh)',
	'meter.photo': 'Foto (pilihan)',
	'meter.send': 'Hantar bacaan',
	'meter.resized': 'Saiz foto dikecilkan kepada {kb} KB.',
	'meter.tooLarge':
		'Foto ini terlalu besar (maksimum 300 KB). Cuba foto yang lebih kecil, atau hantar tanpa foto.',
	'meter.photoLink': 'foto',
	'meter.status.pending': 'Menunggu',
	'meter.status.confirmed': 'Disahkan',
	'meter.status.rejected': 'Ditolak',
	'meter.reason': 'Sebab: {reason}',
	'meter.opening': 'Bacaan permulaan',
	'meter.used': '{kwh} digunakan oleh bilik',

	'deposit.heading': 'Deposit diselesaikan pada {date}',
	'deposit.held': 'Deposit dipegang',
	'deposit.deduction': 'Potongan: {label}',
	'deposit.unpaid': 'Sewa dan bil belum dibayar',
	'deposit.refund': 'Bayaran balik',
	'deposit.refundedBy': 'Dibayar balik melalui {method}.',
	'deposit.refundedByRef': 'Dibayar balik melalui {method} (rujukan {ref}).',

	'statement.pageTitle': 'Penyata {period}',
	'statement.monthNav': 'Bulan penyata',
	'statement.month': 'Bulan',
	'statement.show': 'Papar',
	'statement.download': 'Muat turun (HTML)',
	'statement.title': 'Penyata bulanan {period}',
	'statement.landlordLine': 'Tuan rumah {landlord} · sewa {rent}/bulan',
	'statement.carried': 'Baki dibawa ke hadapan',
	'statement.brought': 'Baki dibawa dari bulan lalu',
	'statement.empty': 'Tiada caj atau bayaran bulan ini.',
	'statement.note':
		'Caj disenaraikan mengikut bulan bil dan bayaran mengikut tarikh dibayar. Baki negatif ialah kredit untuk penyewa. Penyata ini bukan invois cukai.',
	'statement.generated': 'dijana {date}',
	'statement.bedLabel': 'Katil',
	'statement.monthlyRent': 'Sewa bulanan',

	'receipt.pageTitle': 'Resit {number}',
	'receipt.title': 'Resit bayaran',
	'receipt.from': 'Diterima daripada',
	'receipt.for': 'Untuk',
	'receipt.note':
		'Direkodkan oleh tuan rumah dalam biliksewa. Ini ialah pengakuan penerimaan bayaran, bukan invois cukai.',

	'reminders.title': 'Peringatan tunggakan',
	'reminders.intro':
		'Siapa berhutang apa setakat {today}. Salin mesej ke WhatsApp, SMS atau e-mel sendiri: biliksewa tidak menghantar apa-apa.',
	'reminders.summary': 'Ringkasan tunggakan',
	'reminders.total': 'Jumlah tunggakan',
	'reminders.count': 'Penyewa tertunggak',
	'reminders.since': '{days} tertunggak (sejak {date})',
	'reminders.messageLang': 'Bahasa mesej',
	'reminders.messageFor': 'Mesej peringatan untuk {name}',
	'reminders.copy': 'Salin mesej',
	'reminders.statement': 'Penyata',
	'reminders.copied': 'Disalin',
	'reminders.none': 'Tiada sesiapa yang tertunggak. 🎉',

	'reminder.greeting': 'Hai {tenant}, ini peringatan mesra daripada {landlord} tentang {where}.',
	'reminder.asOf': 'Setakat {today}, {total} telah tertunggak:',
	'reminder.item': '- {description} (tarikh akhir {due}): {amount}, tertunggak {days}',
	'reminder.closing':
		'Sila bayar apabila boleh dan hantarkan rujukan pindahan kepada saya. Jika sudah membayar, sila abaikan mesej ini. Terima kasih!'
};

const zh: Messages = {
	'locale.label': '语言',
	'nav.main': '主导航',
	'nav.dashboard': '概览',
	'nav.properties': '物业',
	'nav.tenants': '租客',
	'nav.billing': '账单',
	'nav.meters': '电表',
	'nav.reminders': '催缴提醒',
	'nav.export': '导出',
	'common.signOut': '退出登录',
	'common.bed': '床位 {label}',
	'common.day': '{n} 天',
	'common.days': '{n} 天',
	'common.movedOut': '已于 {date} 退租',
	'common.print': '打印 / 另存为 PDF',
	'common.tenant': '租客',
	'common.landlord': '房东',
	'footer.app': '演示数据均为虚构。马来西亚今日：{today}',
	'footer.portal': '仅可查看您自己的账户。对费用有疑问？请联系房东。马来西亚今日：{today}',

	'login.title': '登录',
	'login.intro': '面向房东及其租客的房间与床位出租管理。请登录以继续。',
	'login.email': '电子邮箱',
	'login.password': '密码',
	'login.submit': '登录',
	'login.demoAccounts': '演示账号（虚构数据）：',
	'login.publicDemo': '这是公开演示。任何人都可以修改数据，数据每小时恢复为示例数据。',
	'login.wrong': '邮箱或密码错误',
	'login.tooMany': '登录尝试次数过多，请在 {minutes} 分钟后重试。',

	'invite.title': '租客邀请',
	'invite.heading': 'biliksewa 租客门户',
	'invite.intro': '{landlord} 邀请 {tenant} 在线查看租金、账单和付款记录。设置密码即可完成。',
	'invite.confirm': '确认密码',
	'invite.submit': '创建我的账户',
	'invite.expires': '此链接只能使用一次，将于 {date} 失效。',
	'invite.invalid': '此邀请链接无效，可能已被使用或已过期。请向房东索取新链接。',
	'invite.goSignIn': '前往登录',

	'portal.title': '我的租金',
	'portal.back': '← 我的租金',
	'portal.hi': '您好，{name}',
	'portal.intro': '您的租金、分摊账单和付款记录。',
	'portal.stayAt': '{property} 的租住记录',
	'portal.staying': '在住',
	'portal.details':
		'{area} · {room} · {bed} · 自 {start} 起 · {rent}/月 · 押金 {deposit} · 房东 {landlord}',
	'portal.balanceGroup': '余额',
	'portal.billed': '应付',
	'portal.paid': '已付',
	'portal.balance': '余额',
	'portal.overdue': '逾期 {amount}',
	'portal.nothingOverdue': '无逾期款项',
	'portal.statement': '月结单',
	'portal.statementFor': '{property} 的月结单',
	'portal.noTenancy': '此账户尚未关联任何租约。',
	'portal.readingSent': '读数 {kwh} 已发送给房东',

	'col.due': '到期日',
	'col.date': '日期',
	'col.description': '说明',
	'col.amount': '金额',
	'col.unpaid': '未付',
	'col.paidOn': '付款日期',
	'col.method': '方式',
	'col.reference': '参考号',
	'col.receipt': '收据',
	'col.charge': '费用',
	'col.payment': '付款',
	'col.balance': '余额',
	'col.daysOverdue': '逾期天数',
	'col.readOn': '抄表日期',
	'col.reading': '读数',
	'col.status': '状态',
	'col.yourShare': '您的分摊',

	'ledger.charges': '费用',
	'ledger.payments': '付款',
	'ledger.paid': '已付',
	'ledger.noCharges': '暂无费用。',
	'ledger.noPayments': '暂无付款。',
	'receipt.link': '收据',
	'receipt.linkLabel': '{date} 支付 {amount} 的收据',
	'method.cash': '现金',
	'method.bank_transfer': '银行转账',
	'method.other': '其他',
	'method.deposit': '从押金扣除',

	'meter.heading': '电表（您的房间）',
	'meter.billedAt': '电费单价 {rate}。',
	'meter.lastConfirmed': '最近确认的读数：{kwh}（{date}）。',
	'meter.noConfirmed': '尚无已确认的读数。',
	'meter.waiting': '您房间的一条读数正在等待房东核对。',
	'meter.reading': '读数（kWh）',
	'meter.photo': '照片（可选）',
	'meter.send': '提交读数',
	'meter.resized': '照片已压缩至 {kb} KB。',
	'meter.tooLarge': '照片太大（最大 300 KB）。请换一张较小的照片，或不附照片提交。',
	'meter.photoLink': '照片',
	'meter.status.pending': '待核对',
	'meter.status.confirmed': '已确认',
	'meter.status.rejected': '已退回',
	'meter.reason': '原因：{reason}',
	'meter.opening': '初始读数',
	'meter.used': '房间用电 {kwh}',

	'deposit.heading': '押金已于 {date} 结算',
	'deposit.held': '押金',
	'deposit.deduction': '扣除：{label}',
	'deposit.unpaid': '未付租金和账单',
	'deposit.refund': '退还',
	'deposit.refundedBy': '已通过{method}退还。',
	'deposit.refundedByRef': '已通过{method}退还（参考号 {ref}）。',

	'statement.pageTitle': '{period} 月结单',
	'statement.monthNav': '结单月份',
	'statement.month': '月份',
	'statement.show': '查看',
	'statement.download': '下载（HTML）',
	'statement.title': '{period} 月结单',
	'statement.landlordLine': '房东 {landlord} · 租金 {rent}/月',
	'statement.carried': '结转余额',
	'statement.brought': '上期结余',
	'statement.empty': '本月没有费用或付款。',
	'statement.note':
		'费用按账单月份列出，付款按付款日期列出。负余额表示租客有余款。本结单不是税务发票。',
	'statement.generated': '生成于 {date}',
	'statement.bedLabel': '床位',
	'statement.monthlyRent': '月租',

	'receipt.pageTitle': '收据 {number}',
	'receipt.title': '付款收据',
	'receipt.from': '付款人',
	'receipt.for': '租住',
	'receipt.note': '由房东在 biliksewa 中记录。本收据仅为付款确认，不是税务发票。',

	'reminders.title': '逾期催缴提醒',
	'reminders.intro':
		'截至 {today} 的欠款情况。请自行将消息复制到 WhatsApp、短信或电子邮件：biliksewa 不会发送任何消息。',
	'reminders.summary': '逾期概况',
	'reminders.total': '逾期总额',
	'reminders.count': '逾期租客',
	'reminders.since': '已逾期 {days}（自 {date} 起）',
	'reminders.messageLang': '消息语言',
	'reminders.messageFor': '发给 {name} 的提醒消息',
	'reminders.copy': '复制消息',
	'reminders.statement': '月结单',
	'reminders.copied': '已复制',
	'reminders.none': '没有人逾期。🎉',

	'reminder.greeting': '{tenant} 您好，这是 {landlord} 关于 {where} 的友情提醒。',
	'reminder.asOf': '截至 {today}，逾期金额为 {total}：',
	'reminder.item': '- {description}（到期日 {due}）：{amount}，已逾期 {days}',
	'reminder.closing': '方便时请付款，并把转账参考号发给我。如已付款，请忽略此消息。谢谢！'
};

export const MESSAGES: Record<Locale, Messages> = { en, ms, zh };

export type Params = Record<string, string | number>;
export type Translator = (key: MessageKey, params?: Params) => string;

export function isLocale(value: unknown): value is Locale {
	return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** The message for `key` in `locale` with `{name}` placeholders filled; unknown placeholders stay as-is. */
export function translate(locale: Locale, key: MessageKey, params?: Params): string {
	const template = MESSAGES[locale]?.[key] ?? en[key] ?? key;
	if (!params) return template;
	return template.replace(/\{(\w+)\}/g, (match, name: string) =>
		Object.hasOwn(params, name) ? String(params[name]) : match
	);
}

export function translator(locale: Locale): Translator {
	return (key, params) => translate(locale, key, params);
}

/** "1 day" / "3 days" (BM and Chinese do not change the noun). */
export function dayCount(t: Translator, n: number): string {
	return t(n === 1 ? 'common.day' : 'common.days', { n });
}

/**
 * The visitor's language: the saved cookie if valid, otherwise the best supported match from the
 * browser's Accept-Language header, otherwise English.
 */
export function pickLocale(
	cookie: string | undefined | null,
	acceptLanguage: string | null
): Locale {
	if (isLocale(cookie)) return cookie;
	if (!acceptLanguage) return DEFAULT_LOCALE;
	const ranked = acceptLanguage
		.split(',')
		.slice(0, 20)
		.map((part, index) => {
			const [tag, ...rest] = part.trim().toLowerCase().split(';');
			const q = rest.map((p) => /^\s*q=([0-9.]+)\s*$/.exec(p)?.[1]).find((v) => v !== undefined);
			return { tag, q: q === undefined ? 1 : Number(q), index };
		})
		.filter((r) => r.tag && Number.isFinite(r.q) && r.q > 0)
		.sort((a, b) => b.q - a.q || a.index - b.index);
	for (const { tag } of ranked) {
		const primary = tag.split('-')[0];
		if (primary === 'en') return 'en';
		if (primary === 'ms' || primary === 'zsm') return 'ms';
		if (primary === 'zh') return 'zh';
	}
	return DEFAULT_LOCALE;
}

const METHOD_KEYS: Record<string, MessageKey> = {
	cash: 'method.cash',
	bank_transfer: 'method.bank_transfer',
	other: 'method.other',
	deposit: 'method.deposit'
};

/** Message key for a stored payment method (unknown values show as "Other"). */
export function methodKey(method: string): MessageKey {
	return Object.hasOwn(METHOD_KEYS, method) ? METHOD_KEYS[method] : 'method.other';
}
