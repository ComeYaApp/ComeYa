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

function _getAnimationTimestamp() {
  return typeof performance !== "undefined" && performance.now
    ? performance.now()
    : Date.now();
}

function _setGlobalConsole() {}
function _scheduleOnJS() {}
function _scheduleOnJSFromUI() {}
function _scheduleOnRemoteRuntime() {}

var updateProps = function () {};
var createAnimatedProp = function () {};
var processColor = function (c) { return c; };
var ReanimatedEventEmitter = { addListener: function () {}, removeAllListeners: function () {} };
var ReanimatedModule = {
  createNode: function () { return 0; },
  dropNode: function () {},
  configureProps: function () {},
  connectNodes: function () {},
  disconnectNodes: function () {},
  addListener: function () {},
  removeListeners: function () {},
  animateNextTransition: function () {},
  getValue: function () { return 0; },
  setValue: function () {},
  triggerRender: function () {},
};

module.exports = {
  init, makeShareable, makeShareableCloneOnUIRecursive, makeShareableCloneRecursive,
  isShareableRef, createSerializable, isSerializableRef, isSynchronizable,
  createSynchronizable, isWorkletFunction, getRuntimeKind, RuntimeKind,
  createWorkletRuntime, runOnRuntime, callMicrotasks, executeOnUIRuntimeSync,
  runOnJS, runOnUI, runOnUIAsync, runOnUISync, scheduleOnRN, scheduleOnUI,
  unstable_eventLoopTask, shareableMappingCache, serializableMappingCache,
  WorkletsModule, WorkletsError, JSWorklets, getStaticFeatureFlag, setDynamicFeatureFlag,
  _getAnimationTimestamp, _setGlobalConsole, _scheduleOnJS,
  _scheduleOnJSFromUI, _scheduleOnRemoteRuntime,
  updateProps, createAnimatedProp, processColor,
  ReanimatedEventEmitter, ReanimatedModule,
};
