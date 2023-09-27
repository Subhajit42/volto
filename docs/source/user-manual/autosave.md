---
myst:
  html_meta:
    "description": "User manual for how Volto autosaves data in Plone 6."
    "property=og:description": "User manual for how Volto autosaves data in Plone 6."
    "property=og:title": "How to autosave content in Volto when editing, adding, or commenting on content."
    "keywords": "Volto, Plone, frontend, React, User manual, autosave, restore"
---

(autosave-content-label)=

# Autosave content

The autosave feature allows you to restore locally saved data, in case of accidental browser close, refresh, quit, or change page.
It uses the [`localStorage` property](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).
It clears the data when either the form is saved or you cancel restoring the local data.
If local data is found for the specific content, a toast is shown that allows you to either restore ({guilabel}`OK`) or discard ({guilabel}`Cancel`) it.
If local data is older than data on the server, it will still show the toast, but it will specify that the found local data is older than the server data.


(autosave-edit-mode-label)=

## Autosave edit mode

A local copy of the form is saved in `localStorage` when you start to edit, not when you merely open the page in edit mode.
Changing the form will update the `localStorage` with a new complete copy of the form.
In case you close the tab, quit, refresh, change the page, or cancel editing, when you revisit the page in edit mode, it will display a toast for the found data.
Data is saved with a unique id:

```js
  const id = isEditForm
    ? ['form', type, pathname].join('-') // edit
    : type
    ? ['form', pathname, type].join('-') // add
    : schema?.properties?.comment
    ? ['form', pathname, 'comment'].join('-') // comments
    : ['form', pathname].join('-');
```

Local data for the current content will be deleted, when you save the form or choose {guilabel}`Cancel` from the toast.


(autosave-new-content-label)=

## Autosave new content

When adding content, a copy of the form will be saved in `localStorage`, similar to edit mode.
But since the content hasn't been saved yet, we don't have an ID.
In this case the content type will be used.
Since it also uses the path to create the ID, the local data will be restored if you exit without saving, and only if you add the same content in the same path.


(autosave-comments-label)=

## Autosave comments

Comments are also saved locally, even though you are not in edit or add mode.
After restoring local data, if a comment is submitted, it will be deleted from `localStorage`.