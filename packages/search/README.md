# Search

The search module.

## Installation

Install the package.

```bash
yarn add @automattic/search
```

## Internationalization

This package depends directly on `@wordpress/i18n` for translations. This means consumers must provide locale data prior to using it.

## Development Workflow

This package is developed as part of the Calypso monorepo. Run `yarn`
in the root of the repository to get the required `devDependencies`.

## Using [Storybook](https://storybook.js.org/)

`yarn workspace @automattic/search run storybook`

## What's Included?

### Search Input

A search input component.

#### Search Modes

There are 2 search modes that can be used through the `searchMode` prop:

- `when-typing` (default): The search component calls the `onSearch` prop while the user is typing.
- `on-enter`: The search component only triggers the `onSearch` prop when the user hits the `Enter` key.

### `useFuzzySearch`

A hook that exposes fuzzy searching functionality.

`useFuzzySearch` can be beneficial especially as the size of the dataset grows because this mechanism maintains an index instead of simply walking through the whole array looking for matches.

Also, some users might want to find an object that they do not remember the exact name, so entering a partial string, or even one with typos, would still return results ranked by proximity.

Example: imagine you're querying for `example.wordpress.com`. While "normal", substring search, would fail if you've searched for `exmple`, fuzzy search would still return the result.

#### Usage

The simplest form of usage is to pass an array of strings as the `data` argument, which is your collection:

```js
const Component = () => {
	const { results, query, setQuery } = useFuzzySearch( {
		data: [ 'site.wordpress.com', 'another.wordpress.com' ],
	} );
};
```

The hook returns an object with a few properties:
- `results`, which is your data;
- `query`, that is the searched term;
- `setQuery`, so you can change the term after an event (i.e. input change).


##### Searching an Array of Objects

You can also pass an array of objects as the `data`. That way you can search inside objects:

```js
const Component = () => {
	useFuzzySearch( {
		data: [ { siteURL: 'site.wordpress.com', nested: { key: 'value' } } ],
		keys: [ 'siteURL', 'nested.key' ],
	} );
};
```

Note that you must pass the `keys` argument so the hook indexes those keys. Those are the keys that will be accounted when searching. That argument is **required** when you're working with an array of objects.

##### Setting Custom Options

Beyond passing `keys` (and [its variations](https://fusejs.io/examples.html)), you can extend the hook by providing the `options` argument, which will extend the fuzzy search mechanism following [the options described by Fuse.js](https://fusejs.io/api/options.html).

##### Setting an Initial Query

It's also possible to set an initial query through the `initialQuery` argument. That'll be the the initial state for the returned `query` property and will be used as the initial search filter.
