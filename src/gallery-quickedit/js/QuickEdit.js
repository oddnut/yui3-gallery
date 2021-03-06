/**
 * <p>The QuickEdit plugin provides a new mode for DataTable where all
 * values in the table can be edited simultaneously, controlled by the
 * column configuration.  Each editable cell contains an input field.  If
 * the user decides to save the changes, then you can extract the changed
 * values by calling <code><i>dt</i>.qe.getChanges()</code>.</p>
 *
 * <p>For a column to be editable in QuickEdit mode, the column
 * configuration must include <code>quickEdit</code>.  The contents of
 * this object define the column's behavior in QuickEdit mode.</p>
 *
 * <p>To move up or down within a column while in QuickEdit mode, hold down
 * the Ctrl key and press the up or down arrow.</p>
 *
 * <p>If a column should not be editable, but needs to be formatted
 * differently in QuickEdit mode, then you must define qeFormatter in
 * the column configuration. This is simply a normal cell formatter
 * function that will be used in QuickEdit mode.  The static functions
 * <code>readonly*Formatter</code> provide examples.</p>
 *
 * <p>The following configuration can be provided as part of
 * quickEdit:</p>
 *
 * <dl>
 *
 * <dt>changed</dt><dd>Optional.  The function to call with the old and new
 * value.  Should return true if the values are different.</dd>
 *
 * <dt>formatter</dt><dd>The cell formatter which will render an
 * appropriate form field: &lt;input type="text"&gt;, &lt;textarea&gt;,
 * or &lt;select&gt;.</dd>
 *
 * <dt>validation</dt><dd>Validation configuration for every field in
 * the column.</dd>
 *
 * </dl>
 *
 * <p>The following configuration can be provided as part of
 * quickEdit.validation:</p>
 *
 * <dl>
 *
 * <dt>css</dt><dd>CSS classes encoding basic validation rules:
 *  <dl>
 *  <dt><code>yiv-required</code></dt>
 *      <dd>Value must not be empty.</dd>
 *
 *  <dt><code>yiv-length:[x,y]</code></dt>
 *      <dd>String must be at least x characters and at most y characters.
 *      At least one of x and y must be specified.</dd>
 *
 *  <dt><code>yiv-integer:[x,y]</code></dt>
 *      <dd>The integer value must be at least x and at most y.
 *      x and y are both optional.</dd>
 *
 *  <dt><code>yiv-decimal:[x,y]</code></dt>
 *      <dd>The decimal value must be at least x and at most y.  Exponents are
 *      not allowed.  x and y are both optional.</dd>
 *  </dl>
 * </dd>
 *
 * <dt>fn</dt><dd>A function that will be called with the DataTable as its
 * scope and the cell's form element as the argument. Return true if the
 * value is valid. Otherwise, call this.qe.displayMessage(...) to display
 * an error and return false.</dd>
 *
 * <dt>msg</dt><dd>A map of types to messages that will be displayed
 * when a basic or regex validation rule fails. The valid types are:
 * required, min_length, max_length, integer, decimal, and regex.
 * There is no default for type regex, so you must specify a message if
 * you configure a regex validation.</dd>
 *
 * <dt>regex</dt><dd>Regular expression that the value must satisfy in
 * order to be considered valid.</dd>
 *
 * </dl>
 *
 * @module gallery-quickedit
 * @class Y.Plugin.DataTableQuickEdit
 * @constructor
 * @param config {Object} Object literal to set component configuration.
 */

/*
 *
 * <dt>copyDown</dt><dd>If true, the top cell in the column will have a
 * button to copy the value down to the rest of the rows.</dd>
 *
 * <p>Custom QuickEdit Formatters</p>
 *
 * <p>To write a custom cell formatter for QuickEdit mode, you must
 * structure the function as follows:</p>
 *
 * <pre>
 * function myQuickEditFormatter(o) {
 * &nbsp;&nbsp;var markup =
 * &nbsp;&nbsp;&nbsp;&nbsp;'&lt;input type="text" class="{yiv} quickedit-field quickedit-key:{key}"/&gt;' +
 * &nbsp;&nbsp;&nbsp;&nbsp;Y.Plugin.QuickEdit.error_display_markup;
 *
 * &nbsp;&nbsp;&nbsp;&nbsp;var qe = o.column.get('quickEdit');
 *
 * &nbsp;&nbsp;&nbsp;&nbsp;o.td.set('innerHTML', Y.Lang.sub(markup, {
 * &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;key: o.column.get('key'),
 * &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;yiv: qe.validation ? (qe.validation.css || '') : ''
 * &nbsp;&nbsp;&nbsp;&nbsp;}));
 *
 * &nbsp;&nbsp;&nbsp;&nbsp;o.td.get('firstChild').value = extractMyEditableValue(o);
 *
 * &nbsp;&nbsp;&nbsp;&nbsp;Y.Plugin.QuickEdit.copyDownFormatter.apply(this, arguments);
 * };
 * </pre>
 *
 * <p>You can use textarea or select instead of input, but you can only
 * create a single field.</p>
 *
 * <p><code>extractMyEditableValue</code> does not have to be a separate
 * function. The work should normally be done inline in the formatter
 * function, but the name of the sample function makes the point clear.</p>
 */
function QuickEdit(config)
{
	QuickEdit.superclass.constructor.call(this, config);
}

QuickEdit.NAME = "QuickEditPlugin";
QuickEdit.NS   = "qe";

QuickEdit.ATTRS =
{
	/**
	 * @attribute changesAlwaysInclude
	 * @description Record keys to always include in result from getChanges().
	 * @type Array
	 */
	changesAlwaysInclude:
	{
		value:     [],
		validator: Y.Lang.isArray
	}
};

var class_re_prefix        = '(?:^|\\s)(?:',
	class_re_suffix        = ')(?:\\s|$)',
	quick_edit_re          = /quickedit-key:([^\s]+)/,
	qe_row_status_prefix   = 'quickedit-has',
	qe_row_status_pattern  = qe_row_status_prefix + '([a-z]+)',
	qe_row_status_re       = new RegExp(class_re_prefix + qe_row_status_pattern + class_re_suffix),
	qe_cell_status_prefix  = 'quickedit-has',
	qe_cell_status_pattern = qe_cell_status_prefix + '([a-z]+)',
	qe_cell_status_re      = new RegExp(class_re_prefix + qe_cell_status_pattern + class_re_suffix);

/**
 * <p>Names of supported status values, highest precedence first.  Default:
 * <code>[ 'error', 'warn', 'success', 'info' ]</code></p>
 *
 * <p>This is static because it links to CSS rules that define the
 * appearance of each status type:  .formmgr-has{status}</p>
 *
 * @config YAHOO.widget.QuickEditDataTable.status_order
 * @type {Array}
 * @static
 */
QuickEdit.status_order =
[
	'error',
	'warn',
	'success',
	'info'
];

function getStatusPrecedence(
	/* string */    status)
{
	for (var i=0; i<QuickEdit.status_order.length; i++)
	{
		if (status == QuickEdit.status_order[i])
		{
			return i;
		}
	}

	return QuickEdit.status_order.length;
}

function statusTakesPrecendence(
	/* string */    orig_status,
	/* string */    new_status)
{
	return (!orig_status || getStatusPrecedence(new_status) < getStatusPrecedence(orig_status));
}

/**
 * The CSS class that marks the container for the error message inside a cell.
 *
 * @property Y.Plugin.QuickEdit.error_text_class
 * @type {String}
 */
QuickEdit.error_text_class = 'quickedit-message-text';

/**
 * The markup for the container for the error message inside a cell.
 *
 * @property Y.Plugin.QuickEdit.error_display_markup
 * @type {String}
 */
QuickEdit.error_display_markup = '<div class="quickedit-message-text"></div>';

/**
 * Called with exactly the same arguments as any other cell
 * formatter, this function displays an input field.
 *
 * @method Y.Plugin.QuickEdit.textFormatter
 * @static
 */
QuickEdit.textFormatter = function(o)
{
/*
	var markup =
		'<input type="text" class="{yiv} quickedit-field quickedit-key:{key}"/>' +
		QuickEdit.error_display_markup;

	var qe = o.column.get('quickEdit');

	o.td.set('innerHTML', Y.Lang.sub(markup,
	{
		key: o.column.get('key'),
		yiv: qe.validation ? (qe.validation.css || '') : ''
	}));

	o.td.get('firstChild').value = o.value;

	QuickEdit.copyDownFormatter.apply(this, arguments);
*/
	var markup =
		'<input type="text" class="{yiv} quickedit-field quickedit-key:{key}" value="{value}"/>' +
		QuickEdit.error_display_markup;

	var qe = o.column.get('quickEdit');

	return Y.Lang.sub(markup,
	{
		key: o.column.get('key'),
		yiv: qe.validation ? (qe.validation.css || '') : '',
		value: o.value || o.value === 0 ? o.value.toString().replace('"', '') : ''
	});
};

/**
 * Called with exactly the same arguments as any other cell
 * formatter, this function displays a textarea field.
 *
 * @method Y.Plugin.QuickEdit.textareaFormatter
 * @static
 */
QuickEdit.textareaFormatter = function(o)
{
/*
	var markup =
		'<textarea class="{yiv} quickedit-field quickedit-key:{key}"/>' +
		QuickEdit.error_display_markup;

	var qe = o.column.get('quickEdit');

	o.td.set('innerHTML', Y.Lang.sub(markup,
	{
		key: o.column.get('key'),
		yiv: qe.validation ? (qe.validation.css || '') : ''
	}));

	o.td.get('firstChild').value = o.value;

	QuickEdit.copyDownFormatter.apply(this, arguments);
*/
	var markup =
		'<textarea class="{yiv} quickedit-field quickedit-key:{key}" value="{value}"/>' +
		QuickEdit.error_display_markup;

	var qe = o.column.get('quickEdit');

	return Y.Lang.sub(markup,
	{
		key: o.column.get('key'),
		yiv: qe.validation ? (qe.validation.css || '') : '',
		value: o.value || o.value === 0 ? o.value.toString().replace('"', '') : ''
	});
};

/**
 * Called with exactly the same arguments as any other cell
 * formatter, this function displays an email address without the
 * anchor tag.  Use this as the column's qeFormatter if the column
 * should not be editable in QuickEdit mode.
 *
 * @method Y.Plugin.QuickEdit.readonlyEmailFormatter
 * @static
 */
QuickEdit.readonlyEmailFormatter = function(o)
{
	return (o.value || '');		// don't need to check for zero
};

/**
 * Called with exactly the same arguments as any other cell
 * formatter, this function displays a link without the anchor tag.
 * Use this as the column's qeFormatter if the column should not be
 * editable in QuickEdit mode.
 *
 * @method Y.Plugin.QuickEdit.readonlyLinkFormatter
 * @static
 */
QuickEdit.readonlyLinkFormatter = function(o)
{
	return (o.value || '');		// don't need to check for zero
};

function getSiblingTdEl(
	/* Node */	el,
	/* int */	dir)
{
	var tr = null;
	this._tbodyNode.get('children').some(function(node)
	{
		if (node.contains(el))
		{
			tr = node;
			return true;
		}
	});

	if (!tr)
	{
		return null;
	}

	var cell = el.getAncestorByTagName('td', true);

	var col_index = -1;
	tr.get('children').some(function(node, index)
	{
		if (node === cell)
		{
			col_index = index;
			return true;
		}
	});

	tr = (dir < 0 ? tr.previous() : tr.next());
	return tr ? tr.get('children').item(col_index) : null;
}

/*
 * Copy value from first cell to all other cells in the column.
 *
 * @param e {Event} triggering event
 * @param cell {Node} cell from which to copy
 * @private
 */
function copyDown(
	/* event */	e,
	/* Node */	cell)
{
	var field = cell.one('.quickedit-field');
	if (!field)
	{
		return;
	}

	var value = Y.Lang.trim(field.get('value'));
	if (!value && value !== 0)
	{
		return;
	}

	while (1)
	{
		cell = getSiblingTdEl.call(this, cell, +1);
		if (!cell)
		{
			break;
		}

		field = cell.one('.quickedit-field');
		if (field)
		{
			field.set('value', value);
		}
	}
}

/*
 * Called with exactly the same arguments as a normal cell
 * formatter, this function inserts a "Copy down" button if the
 * cell is in the first row of the DataTable.  Call this at the end
 * of your QuickEdit formatter.
 *
 * @method Y.Plugin.QuickEdit.copyDownFormatter
 * @static
 */
QuickEdit.copyDownFormatter = function(o)
{
	if (o.column.get('quickEdit').copyDown && o.rowindex === 0)
	{
		var button = Y.Node.create('<button></button>');
		button.set('title', 'Copy down');
		button.set('innerHTML', '&darr;');

		o.td.insert(button, o.td.one('.' + QuickEdit.error_text_class));

		button.on('click', copyDown, o.td, this);
	}
};

function wrapFormatter(editFmt, origFmt)
{
	return function(o)
	{
		return (o.record ? editFmt : origFmt).apply(this, arguments);
	};
}

/*
 * Shift the focus up/down within a column.
 *
 * @private
 */
function moveFocus(e)
{
	var cell = getSiblingTdEl.call(this, e.target, e.charCode == 38 ? -1 : +1);
	if (cell)
	{
		var input = cell.one('.quickedit-field');
		if (input)
		{
			input.focus();
			input.select();
			e.halt(true);
		}
	}
}

/*
 * Validate the given form fields.
 *
 * @param e {Array} Array of form fields.
 * @return {boolean} true if all validation checks pass
 * @private
 */
function validateElements(
	/* NodeList */ list)
{
	var host = this.get('host');
	var cols = host.get('columnset').keyHash;

	var status = true;
	var count  = list.size();
	for (var i=0; i<count; i++)
	{
		var e  = list.item(i);
		var qe = cols[ this._getColumnKey(e) ].get('quickEdit');
		if (!qe)
		{
			continue;
		}
		var msg_list = qe.validation ? qe.validation.msg : null;

		var info = Y.FormManager.validateFromCSSData(e, msg_list);
		if (info.error)
		{
			this.displayMessage(e, info.error, 'error');
			status = false;
			continue;
		}

		if (info.keepGoing)
		{
			if (qe.validation &&
				qe.validation.regex instanceof RegExp &&
				!qe.validation.regex.test(e.get('value')))
			{
				this.displayMessage(e, msg_list ? msg_list.regex : null, 'error');
				status = false;
				continue;
			}
		}

		if (qe.validation &&
			Y.Lang.isFunction(qe.validation.fn) &&
			!qe.validation.fn.call(host, e))
		{
			status = false;
			continue;
		}
	}

	return status;
}

Y.extend(QuickEdit, Y.Plugin.Base,
{
	initializer: function(config)
	{
		this.hasMessages = false;
	},

	/**
	 * Switch to QuickEdit mode.  Columns that have quickEdit defined will
	 * be editable.  If the table has paginators, you must hide them.
	 */
	start: function()
	{
		this.fire('clearErrorNotification');

		var host      = this.get('host');
		var cols      = host.get('columnset').keys;
		this.saveSort = [];
		this.saveEdit = {};
		this.saveFmt  = {};
		for (var i=0; i<cols.length; i++)
		{
			var col = cols[i];
			var key = col.get('key');
			this.saveSort.push(col.get('sortable'));
			col.set('sortable', false);

//			this.saveEdit[key] = col.editor;
//			col.editor         = null;

			var qe  = col.get('quickEdit');
			var qef = col.get('qeFormatter');
			if (/*!col.hidden &&*/ (qe || qef))
			{
				var fn = null;
				if (qe && Y.Lang.isFunction(qe.formatter))
				{
					fn = qe.formatter;
				}
				else if (Y.Lang.isFunction(qef))
				{
					fn = qef;
				}
				else
				{
					fn = QuickEdit.textFormatter;
				}

				if (fn)
				{
					var origFmt       = col.get('formatter');
					var fmt           = wrapFormatter.call(this, fn, origFmt);
					this.saveFmt[key] = origFmt;
					col.set('formatter', fmt);
				}
			}
		}

		var container = host.get('contentBox');
		container.addClass(host.getClassName('quickedit'));
		this.move_event_handle = container.on('key', moveFocus, 'down:38+ctrl,40+ctrl', host);

		host.syncUI();
	},

	/**
	 * Stop QuickEdit mode.  THIS DISCARDS ALL DATA!  If you want to save
	 * the data, call getChanges() BEFORE calling this function.  If the
	 * table has paginators, you must show them.
	 */
	cancel: function()
	{
		this.fire('clearErrorNotification');

		var host = this.get('host');
		var cols = host.get('columnset').keys;
		for (var i=0; i<cols.length; i++)
		{
			var col = cols[i];
			col.set('sortable', this.saveSort[i]);
//			col.set('editor', this.saveEdit[ col.key ]);
		}
		delete this.saveSort;
		delete this.saveEdit;

		cols = host.get('columnset').keyHash;
		Y.Object.each(this.saveFmt, function(fmt, key)
		{
			cols[key].set('formatter', fmt);
		});
		delete this.saveFmt;

		var container = host.get('contentBox');
		container.removeClass(host.getClassName('quickedit'));
		if (this.move_event_handle)
		{
			this.move_event_handle.detach();
			delete this.move_event_handle;
		}

		host.syncUI();
	},

	/**
	 * Return the changed values.  For each row, an object is created with
	 * only the changed values.  The object keys are the column keys.  If
	 * you need values from particular columns to be included always, even
	 * if the value did not change, include the key "changesAlwaysInclude"
	 * in the plugin configuration and pass an array of column keys.
	 *
	 * @return {mixed} array of objects if all validations pass, false otherwise
	 */
	getChanges: function()
	{
		if (!this.validate())
		{
			return false;
		}

		var changes       = [];
		var alwaysInclude = this.get('changesAlwaysInclude');

		var host      = this.get('host');
		var records   = host.get('recordset');
		var rows      = host._tbodyNode.get('children');
		var row_count = rows.size();
		var cols      = host.get('columnset').keyHash;
		for (var i=0; i<row_count; i++)
		{
			var rec  = records.getRecord(i);
			var list = rows.item(i).all('.quickedit-field');

			var change = {};
			changes.push(change);

			var field_count = list.size();
			for (var j=0; j<field_count; j++)
			{
				var field = list.item(j);
				var key   = this._getColumnKey(field);
				var col   = cols[key];
				var qe    = col.get('quickEdit');
				var prev  = rec.getValue(key);

				var val = Y.Lang.trim(field.get('value'));
				if (qe.changed ? qe.changed(prev, val) :
						val !== (prev ? prev.toString() : ''))
				{
					change[key] = val;
				}
			}

			for (var j=0; j<alwaysInclude.length; j++)
			{
				var key     = alwaysInclude[j];
				change[key] = rec.getValue(key);
			}
		}

		return changes;
	},

	/**
	 * Validate the QuickEdit data.
	 *
	 * @return {boolean} true if all validation checks pass
	 */
	validate: function()
	{
		this.clearMessages();
		var status = true;
		var host   = this.get('host');

		var e1 = host._tbodyNode.getElementsByTagName('input');
		var e2 = host._tbodyNode.getElementsByTagName('textarea');
		var e3 = host._tbodyNode.getElementsByTagName('select');

		status = validateElements.call(this, e1) && status;	// status last to guarantee call
		status = validateElements.call(this, e2) && status;
		status = validateElements.call(this, e3) && status;

		if (!status)
		{
			this.fire('notifyErrors');
		}

		return status;
	},

	/**
	 * Clear all validation messages in QuickEdit mode.
	 */
	clearMessages: function()
	{
		this.hasMessages = false;

		this.fire('clearErrorNotification');

		var host = this.get('host');
		host._tbodyNode.getElementsByClassName(qe_row_status_pattern)
			.removeClass(qe_row_status_pattern);
		host._tbodyNode.getElementsByClassName(qe_cell_status_pattern)
			.removeClass(qe_cell_status_pattern);
		host._tbodyNode.all('.' + QuickEdit.error_text_class)
			.set('innerHTML', '');
	},

	/**
	 * Display a message for a QuickEdit field.  If an existing message with
	 * a higher precedence is already visible, it will not be replaced.
	 *
	 * @param e {Element} form field
	 * @param msg {String} message to display
	 * @param type {String} message type: error, warn, success, info
	 * @param scroll {boolean} If false, does not scroll, even if this is the first message to display.
	 */
	displayMessage: function(
		/* element */	e,
		/* string */	msg,
		/* string */	type,
		/* boolean */	scroll)
	{
		if (Y.Lang.isUndefined(scroll))
		{
			scroll = true;
		}

		e       = Y.one(e);
		var row = e.getAncestorByTagName('tr');
		if (statusTakesPrecendence(this._getElementStatus(row, qe_row_status_re), type))
		{
			if (!this.hasMessages && scroll)
			{
				Y.one(row.get('firstChild')).scrollIntoView();
			}

			row.replaceClass(qe_row_status_pattern, qe_row_status_prefix + type);
			this.hasMessages = true;
		}

		var cell = e.getAncestorByTagName('td');
		if (statusTakesPrecendence(this._getElementStatus(cell, qe_cell_status_re), type))
		{
			if (msg)
			{
				cell.one('.' + QuickEdit.error_text_class)
					.set('innerHTML', msg);
			}

			cell.replaceClass(qe_cell_status_pattern, qe_cell_status_prefix + type);
			this.hasMessages = true;
		}
	},

	/**
	 * Return the status of the field.
	 *
	 * @param e {Node} form field
	 * @param r {RegExp} regex to match against className
	 * @return {String}
	 * @protected
	 */
	_getElementStatus: function(
		/* Node */	e,
		/* regex */	r)
	{
		var m = e.get('className').match(r);
		return ((m && m.length) ? m[1] : false);
	},

	/**
	 * Return the column key for the specified field.
	 * 
	 * @param e {Node} form field
	 * @return {String}
	 * @protected
	 */
	_getColumnKey: function(
		/* Node */ e)
	{
		var m = quick_edit_re.exec(e.get('className'));
		return m[1];
	}
});

Y.namespace("Plugin");
Y.Plugin.DataTableQuickEdit = QuickEdit;
