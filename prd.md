Overview

This app helps English learners memorize vocabulary words, including spelling, English meaning, Chinese meaning, IPA American pronunciation marks, and audio pronunciation. It can instantly translate an English word to Chinese meaning and save user-specific vocabulary and quiz progress. Each requirement is marked with a unique ID so it can be tracked clearly.

| ID  | Priority | Issue ID | Status | Category | Description |
| --- | -------- | -------- | ------ | -------- | ----------- |
| 1   | 1        |          |        | input | User inputs vocabulary one word at a time. The input must be a single English word only. Spaces, phrases, punctuation, and numbers are not allowed. Uppercase letters are allowed but should be normalized for dictionary lookup and duplicate checking. |
| 2   | 1        |          |        | input | While the user inputs the word, the app automatically searches the backend dictionary for an exact word match. The app only proposes meanings when the input exactly matches a dictionary word. |
| 3   | 1        |          |        | dictionary | When the dictionary finds an exact match, the app automatically displays the English meaning, Chinese meaning, IPA American pronunciation marks, and an audio playback button. |
| 4   | 1        |          |        | dictionary | If the word has multiple meanings, the app displays the top three meanings in order of usage frequency, with the most frequently used meaning first. |
| 5   | 1        |          |        | input | After the user inputs a word, the user presses a finish button to save or complete the word entry. |
| 6   | 1        |          |        | input | If the input word does not match any word in the dictionary, the app pops up a warning dialog and asks whether the user wants to save the word anyway. |
| 7   | 1        |          |        | input | For an unknown dictionary word, the warning dialog allows the user to save anyway, edit the word, cancel, and manually input the meaning before saving. |
| 8   | 1        |          |        | input | If the user inputs a word that already exists in the user's saved vocabulary list, the app pops up a duplicate-word dialog, tells the user the word is already saved, and ignores the new duplicate entry. |
| 9   | 1        |          |        | dictionary | Before saving, the user can manually correct or edit the dictionary-provided meaning and pronunciation information if the result is wrong or incomplete. |
| 10  | 2        |          |        | input | Dictionary search should feel very fast. If lookup takes noticeable time, the app displays a loading or search-in-progress state. |
| 11  | 1        |          |        | vocabulary | After a new word is saved, it is added to the user's vocabulary list. The app records the date and time when the word was saved. |
| 12  | 1        |          |        | review | Saved vocabulary words are used later for quiz review to help the user memorize the words. |
| 13  | 1        |          |        | account | The app supports multiple users. Users register and sign in with a Google account. |
| 14  | 1        |          |        | storage | The app saves user-specific information, including the user's vocabulary list and quiz review progress, to the user's Google Drive account. |
| 15  | 1        |          |        | storage | When the user logs in again, the app automatically reloads the user's saved vocabulary list and quiz progress. |
| 16  | 1        |          |        | storage | The app keeps a local copy of user data on the device and uses the local copy by default. |
| 17  | 1        |          |        | sync | The app syncs the local vocabulary list and quiz progress with the user's Google Drive account so the same user can use multiple devices and keep data consistent across devices. |
