// Shim para react-native-worklets en web.
// Reanimated 3.x requiere module.exports.

"use strict";
function makeShareable(fn) { return fn; }
function makeShareableCloneOnUIRecursive(fn) { return fn; }
function makeShareableCloneRecursive(fn) { return fn; }
function isShareableRef(v) { return false && v; }
function createSerializable(obj) { return obj || {}; }
function isSerializableRef(v) { return false && v; }
function isSynchronizable(v) { return false && v; }
function createSynchronizable(obj) { return obj || {}; }
function isWorkletFunction(v) { return false && v; }
function getRuntimeKind() { return "js"; }
function createWorkletRuntime() { return {}; }
function runOnRuntime(fn) { return fn; }
function callMicrotasks() { }
function executeOnUIRuntimeSync(fn) { return fn; }
function runOnJS(fn) { return fn; }
function runOnUI(fn) { return fn; }
function runOnUIAsync(fn) { return fn; }
function runOnUISync(fn) { return fn; }
function scheduleOnRN(fn) { return fn; }
function scheduleOnUI(fn) { return fn; }
function init() { }
function getStaticFeatureFlag() { return null; }
function setDynamicFeatureFlag() { }

var unstable_eventLoopTask;
var shareableMappingCache = new Map();
var serializableMappingCache = new Map();
var WorkletsModule = {};
var RuntimeKind = { JS: "js", UI: "ui" };
var WorkletsError = Error;
var JSWorklets = { createSerializableObject: function (obj) { return obj; }, defaultShareableValue: {} };

module.exports = {
  init, makeShareable, makeShareableCloneOnUIRecursive, makeShareableCloneRecursive,
  isShareableRef, createSerializable, isSerializableRef, isSynchronizable,
  createSynchronizable, isWorkletFunction, getRuntimeKind, RuntimeKind,
  createWorkletRuntime, runOnRuntime, callMicrotasks, executeOnUIRuntimeSync,
  runOnJS, runOnUI, runOnUIAsync, runOnUISync, scheduleOnRN, scheduleOnUI,
  unstable_eventLoopTask, shareableMappingCache, serializableMappingCache,
  WorkletsModule, WorkletsError, JSWorklets, getStaticFeatureFlag, setDynamicFeatureFlag,
};