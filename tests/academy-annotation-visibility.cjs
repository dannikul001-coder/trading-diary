'use strict';
// Compatibility entry point: the reference-layout suite replaces the former
// blanket ban on SVG labels. It verifies the reserved annotation gutter and
// retains all 55 authored lessons at three widths in its default quick pass.
if(!process.env.TD_REFERENCE_WIDTHS&&process.env.TD_ANNOTATION_WIDTHS)process.env.TD_REFERENCE_WIDTHS=process.env.TD_ANNOTATION_WIDTHS;
if(!process.env.TD_REFERENCE_KEYS&&process.env.TD_ANNOTATION_KEYS)process.env.TD_REFERENCE_KEYS=process.env.TD_ANNOTATION_KEYS;
if(!process.env.TD_REFERENCE_OUTPUT&&process.env.TD_ANNOTATION_OUTPUT)process.env.TD_REFERENCE_OUTPUT=process.env.TD_ANNOTATION_OUTPUT;
require('./academy-chart-reference.cjs');
