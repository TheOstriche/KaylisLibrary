// App-wide settings. Personal settings (like a Google Books key) are stored on the phone instead;
// see settings in store.js.

export const CONFIG = {
    libraryName: "Kayli's Library",
    loanDays: 21,             // default due date = lending date + this many days
    backupReminderDays: 14,   // nudge to export a backup when changes are older than this
};
