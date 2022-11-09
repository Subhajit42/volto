/**
 * A block-building component that implements a single input based on the Slate
 * Editor. It can render itself as a specified tag.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { defineMessages, useIntl } from 'react-intl';
import config from '@plone/volto/registry';
import { TextLineInput } from '@plone/volto/components';

const messages = defineMessages({
  title: {
    id: 'Type the heading…',
    defaultMessage: 'Type the heading…',
  },
});

const getFieldValue = ({
  data,
  fieldDataName,
  fieldName,
  metadata,
  properties,
}) => {
  return fieldDataName
    ? data?.[fieldDataName] || ''
    : (metadata?.[fieldName] ?? properties?.[fieldName] ?? '') || '';
};

/**
 * A component for inserting an inline textline field for blocks
 */
export const TextLineEdit = (props) => {
  const {
    block,
    blockNode,
    data,
    detached,
    editable,
    index,
    metadata,
    onAddBlock,
    onChangeBlock,
    onChangeField,
    onFocusNextBlock,
    onFocusPreviousBlock,
    onSelectBlock,
    properties,
    selected,
    renderTag,
    renderClassName,
    fieldDataName,
    fieldName = 'title',
    placeholder,
  } = props;

  const intl = useIntl();
  const value = getFieldValue(props);
  const derivedPlaceholder = React.useMemo(
    () =>
      placeholder || data.placeholder || intl.formatMessage(messages['title']),
    [placeholder, data.placeholder, intl],
  );

  const disableNewBlocks = React.useMemo(() => detached, [detached]);
  const handleKeyDown = React.useCallback(
    (ev) => {
      if (ev.key === 'Return' || ev.key === 'Enter') {
        ev.preventDefault();
        if (!disableNewBlocks) {
          onSelectBlock(
            onAddBlock(config.settings.defaultBlockType, index + 1),
          );
        }
      } else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        onFocusPreviousBlock(block, blockNode.current);
      } else if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        onFocusNextBlock(block, blockNode.current);
      }
    },
    [
      index,
      blockNode,
      disableNewBlocks,
      onSelectBlock,
      onAddBlock,
      onFocusPreviousBlock,
      onFocusNextBlock,
      block,
    ],
  );

  const handleFocus = React.useCallback(() => {
    onSelectBlock(block);
  }, [block, onSelectBlock]);

  if (typeof window.__SERVER__ !== 'undefined') {
    return <div />;
  }
  return (
    <TextLineInput
      readOnly={!editable}
      placeholder={derivedPlaceholder}
      value={value}
      onChange={(value) => onChangeBlock()}
      focus={selected}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
    />
  );
};

TextLineEdit.propTypes = {
  properties: PropTypes.objectOf(PropTypes.any).isRequired,
  selected: PropTypes.bool.isRequired,
  block: PropTypes.string.isRequired,
  index: PropTypes.number.isRequired,
  onChangeField: PropTypes.func.isRequired,
  onSelectBlock: PropTypes.func.isRequired,
  onDeleteBlock: PropTypes.func.isRequired,
  onAddBlock: PropTypes.func.isRequired,
  onFocusPreviousBlock: PropTypes.func.isRequired,
  onFocusNextBlock: PropTypes.func.isRequired,
  data: PropTypes.objectOf(PropTypes.any).isRequired,
  editable: PropTypes.bool,
  detached: PropTypes.bool,
  blockNode: PropTypes.any,
  renderTag: PropTypes.string,
  renderClassName: PropTypes.string,
  fieldDataName: PropTypes.string,
};

TextLineEdit.defaultProps = {
  detached: false,
  editable: true,
};

export default TextLineEdit;
