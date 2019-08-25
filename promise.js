// 2.1 A promise must be in one of three states: pending, fulfilled, or rejected.
/**
 * promise的三种状态：等待态，成功态，失败态
 * 等待态可以转化成成功态，也可以转化成失败态，但不可逆
 * 成功态不能转化成失败态，失败态也不能转化成成功态
 */
const PENDING = 'PENDING';
const FULFILLED = 'FULFILLED';
const REJECTED = 'REJECTED';

let resolvePromise = (promise2, x, resolve, reject) => {
  // 2.3.1 If promise and x refer to the same object, reject promise with a TypeError as the reason.
  /**
   * 判断x跟promise2是否相等
   * 因为promise2是一个promise，即判断x跟promise2是否引用同一个promise对象
   * 如果是，则由于promise2是等待态，x也是等待态，代码执行会无法转化为成功态或失败态
   * 同时会出现promise2调用本身的情况，会出现栈溢出的问题
   * 所以直接抛出类型错误
   */
  if (x === promise2) {
    return reject(new TypeError('Chaining cycle detected for promise #<my Promise>'));
  }
  let called = false;
  /**
   * 需要判断x是否为promise，规范给出的判断条件是x类型是function或object，其次x有then方法
   * 1 先判断x的类型是否为function或者非null的object:
   * 1.1 如果不是，则把x传给resolve
   * 1.2 如果是，则把x.then赋给then:
   * 1.2.1 如果then不是一个函数，则把x传给resolve
   * 1.2.2 如果then是一个函数，则判断x为promise，调用then方法把resolve跟reject传入
   * 注意:
   * 1 使用try catch捕获x.then运行时抛出的错误，并把错误传给reject
   * 2 x为其他方案实现的promise，防止可能出现的promise状态问题，需通过call来检查resolve跟reject只能二选一调用
   * 3 then执行返回的y可能也为promise，所以要递归判断y的类型后再传入resolve或reject中
   */
  if (typeof x === 'function' || (typeof x === 'object' && x !== null)) {
    try {
      // 2.3.3.1 Let then be x.then
      let then = x.then;
      if (typeof then === 'function') {
        // 2.2.2.3 it must not be called more than once.
        // 2.2.3.3 it must not be called more than once.
        // 2.3.2.1 If x is pending, promise must remain pending until x is fulfilled or rejected.
        // 
        // 2.3.3.3 If then is a function, call it with x as this, first argument resolvePromise, and second argument rejectPromise, where:
        // 2.3.3.3.1 If/when resolvePromise is called with a value y, run [[Resolve]](promise, y).
        // 2.3.3.3.2 If/when rejectPromise is called with a reason r, reject promise with r.
        // 2.3.3.3.3 If both resolvePromise and rejectPromise are called, or multiple calls to the same argument are made, the first call takes precedence, and any further calls are ignored.
        // 2.3.3.3.4 If calling then throws an exception e,
        // 2.3.3.3.4.1 If resolvePromise or rejectPromise have been called, ignore it.
        // 2.3.3.3.4.2 Otherwise, reject promise with e as the reason.
        then.call(x, y => {
          if (called) return;
          called = true;
          resolvePromise (promise2, y, resolve, reject);
        }, r => {
          // 2.3.2.3 If/when x is rejected, reject promise with the same reason.
          if (called) return;
          called = true;
          reject(r);
        })
      } else {
        // 2.3.2.2 If/when x is fulfilled, fulfill promise with the same value.
        // 2.3.3.4 If then is not a function, fulfill promise with x.
        resolve(x)
      }
    } catch (exception) { // 1.4
      // 2.3.2.3
      // 2.3.3.2 If retrieving the property x.then results in a thrown exception e, reject promise with e as the reason.
      if (called) return;
      called = true;
      reject(exception);
    }
  } else {
    // 2.3.2.2
    // 2.3.4 If x is not an object or function, fulfill promise with x.
    resolve(x);
  }
}

let isPromise = (value) => {
  if (typeof value === 'function' || (typeof value === 'object' && value !== null)) {
    if (typeof value.then === 'function') {
      return true;
    }
  }
  return false;
}

// 1.1. “promise” is an object or function with a then method whose behavior conforms to this specification.
class Promise {
  constructor (executor) {
    /**
     * state用来储存promise的状态，初始化为等待态
     * value用来储存成功态时传给resolve的值
     * reason用来储存失败态时传给reject的值
     */
    this.state = PENDING; // 2.1
    this.value = undefined; // 1.3. “value” is any legal JavaScript value (including undefined, a thenable, or a promise).
    this.reason = undefined; // 1.5 “reason” is a value that indicates why a promise was rejected.

    // 2.2.6.1 If/when promise is fulfilled, all respective onFulfilled callbacks must execute in the order of their originating calls to then.
    // 2.2.6.2 If/when promise is rejected, all respective onRejected callbacks must execute in the order of their originating calls to then.
    /**
     * 因为promise允许多次调用then方法，每个then方法都会传入onFulfilled跟onRejected回调
     * 同时，要求在promise的状态转化为成功态时才可以调用onFulfilled，失败态时才可以调用onRejected，需要等待
     * onFulfilled跟onRejected回调返回的都有可能是promise，也需要等待
     * 所以分别使用一个数组储存，等promise的状态转化为成功态或失败态时再通过forEach方法调用数组中的回调方法
     */
    this.onFulfilledStack = [];
    this.onRejectedStack = [];

    let resolve = (value) => {
      if (value instanceof Promise) {
        return value.then(resolve, reject);
      }
      // 2.1.2 When fulfilled, a promise:
      // 2.1.2.1 must not transition to any other state.
      // 2.1.2.2 must have a value, which must not change.
      /**
       * 需要先判断是否为等待态，是才可以转化为成功态，调出等待中的onFulfilled回调
       * 否则不能转化为成功态
       */
      if (this.state === PENDING) {
        this.state = FULFILLED;
        this.value = value;
        this.onFulfilledStack.forEach(fn => fn()); // 2.2.4
      }
    };
    let reject = (reason) => {
      // 2.1.3 When rejected, a promise:
      // 2.1.3.1 must not transition to any other state.
      // 2.1.3.2 must have a reason, which must not change.
      /**
       * 需要先判断是否为等待态，是才可以转化为失败态，调出等待中的onRejected回调
       * 否则不能转化为失败态
       */
      if (this.state === PENDING) {
        this.state = REJECTED;
        this.reason = reason;
        this.onRejectedStack.forEach(fn => fn()); // 2.2.4
      }
    };

    /**
     * 执行executor时使用try catch捕获运行时抛出的错误
     * 并把错误传给reject，相当于promise状态要转化为失败态
     */
    try {
      executor(resolve, reject);
    } catch (exception) { // 1.4 “exception” is a value that is thrown using the throw statement.
      reject(exception);
    }
  }
  // 2.2 The then Method
  // A promise must provide a then method to access its current or eventual value or reason.
  // A promise’s then method accepts two arguments:
  // promise.then(onFulfilled, onRejected)
  /**
   * promise要求一定要有一个then方法
   * 可以传入onFulfilled, onRejected
   */
  then (onFulfilled, onRejected) {
    // 2.2.1 Both onFulfilled and onRejected are optional arguments:
    // 2.2.1.1 If onFulfilled is not a function, it must be ignored.
    // 2.2.1.2 If onRejected is not a function, it must be ignored.
    // 2.2.7.3 If onFulfilled is not a function and promise1 is fulfilled, promise2 must be fulfilled with the same value as promise1.
    // 2.2.7.4 If onRejected is not a function and promise1 is rejected, promise2 must be rejected with the same reason as promise1.
    /**
     * 需要判断用户传入的onFulfilled, onRejected的类型
     * 如果用户传入的onFulfilled, onRejected是funciton类型，则可以直接使用
     * 否则需要忽略传入的值
     * 但是promise成功或者失败后的value或reason需要传给下一个then
     * 所以这种情况下可以初始化一个箭头函数，把value或reason传出
     */
    onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : value => value;
    onRejected = typeof onRejected === 'function' ? onRejected : err => {throw err};
    let promise2;
    promise2 = new Promise((resolve, reject) => {
      if (this.state === FULFILLED) {
        // 2.2.2.1 it must be called after promise is fulfilled, with promise’s value as its first argument.
        /**
         * promise转化为成功态之后才能调用onFulfilled，并且传入的第一个参数为value
         */
        setTimeout(() => {
          try {
            // 2.2.7.1 If either onFulfilled or onRejected returns a value x, run the Promise Resolution Procedure [[Resolve]](promise2, x).
            /**
             * 获得onFulfilled执行后返回的值，赋给x，并跟promise2一并传入resolvePromise方法中
             */
            let x = onFulfilled(this.value);
            resolvePromise(promise2, x, resolve, reject);
          } catch (exception) { // 1.4
            // 2.2.7.2 If either onFulfilled or onRejected throws an exception e, promise2 must be rejected with e as the reason.
            /**
             * 使用try catch捕获onFulfilled执行时的错误，如果报错则把抛出来的错误传入reject
             */
            reject(exception);
          }
        })
      }
      if (this.state === REJECTED) {
        // 2.2.3.1 it must be called after promise is rejected, with promise’s reason as its first argument.
        /**
         * promise转化为失败态之后才能调用onRejected，并且传入的第一个参数为reason
         */
        setTimeout(() => {
          try {
            // 2.2.7.1
            let x = onRejected(this.reason);
            resolvePromise(promise2, x, resolve, reject);
          } catch (exception) { // 1.4
            // 2.2.7.2
            reject(exception);
          }
        })
      }
      if (this.state === PENDING) {
        // 2.2.4 onFulfilled or onRejected must not be called until the execution context stack contains only platform code.
        // 2.2.2.2 it must not be called before promise is fulfilled.
        /**
         * 如果promise为等待态，则不能直接调用onFulfilled或onRejected
         * 所以先把onFulfilled跟onRejected分别存到一个数组中
         * 等待promise状态变化后再调出对应的回调
         */
        this.onFulfilledStack.push(() => { // 2.2.5 onFulfilled and onRejected must be called as functions (i.e. with no this value). 
          setTimeout(() => {
            try {
              // 2.2.7.1
              let x = onFulfilled(this.value);
              resolvePromise(promise2, x, resolve, reject);
            } catch (exception) { // 1.4
              // 2.2.7.2
              reject(exception);
            }
          })
        });
        // 2.2.3.2 it must not be called before promise is rejected.
        this.onRejectedStack.push(() => { // 2.2.5
          setTimeout(() => {
            try {
              // 2.2.7.1
              let x = onRejected(this.reason);
              resolvePromise(promise2, x, resolve, reject);
            } catch (exception) { // 1.4
              // 2.2.7.2
              reject(exception);
            }
          })
        });
      }
    })
    // 2.2.7 then must return a promise
    /**
     * then必须返回一个新的promise
     * 才能实现promise链式调用
     */
    return promise2;
  }
}

Promise.catch = function (onRejected) {
  /**
   * 原理上是调用then方法
   * onFulfilled = null
   */
  return this.then(null, onRejected);
}

Promise.resolve = function (value) {
  /**
   * 相当于新建一个promise
   * 然后直接调用resolve
   */
  return new Promise((resolve, reject) => {
    resolve(value);
  })
}

Promise.reject = function (reason) {
  /**
   * 相当于新建一个promise
   * 然后直接调用reject
   */
  return new Promise((resolve, reject) => {
    reject(reason);
  })
}

Promise.finally = function (callback) {
  /**
   * 因为callback的执行可能是异步的
   * 所以先通过Promis.resolve执行callback，然后在调then把原来的成功的value或失败的reason传出去
   */
  return this.then(value => {
    return new Promise.resolve(callback()).then(() => value);
  }, reason => {
    return new Promise.resolve(callback()).then(() => {throw reason})
  })
}

Promise.all = function (values) {
  /**
   * arr为结果数组
   * i为计数器
   * 逐一执行values
   * 如果current是promise，则执行current.then把成功的y传给resolve，失败则调reject
   * 如果current不是promise，则直接把current存入arr相应位置
   * 每次存入结果，都会++i，并判断i是否等于values的长度
   * 是则说明所有结果都获得，返回arr
   * 如果任意current调用了reject，则promise转化为失败态
   */
  return new Promise((resolve, reject) => {
    let arr = [];
    let i = 0;
    let processData = (index, value) => {
      arr[index] = value;
      if (++i === values.length) {
        resolve(arr);
      }
    } 
    for (let i = 0; i < values.length; i++) {
      let current = values[i];
      if (isPromise(current)) {
        current.then(y => {
          processData(i, y);
        }, reject)
      } else {
        processData(i, current);
      }
    }
  })
}

Promise.race = function (values) {
  /**
   * Promise.race只接收最快返回调用resolve或reject的current
   * 所以只要判断current是Promise，则current.then传入resolve跟reject
   * 否则调用resolve传入current
   */
  return new Promise((resolve, reject) => {
    for (let i = 0; i < values.length; i++) {
      let current = values[i];
      if (isPromise(current)) {
        current.then(resolve, reject);
      } else {
        resolve(current);
      }
    }
  })
}

/**
 * 检查工具 promises-aplus-tests
 * 安装: npm i promises-aplus-tests
 * 使用: promises-aplus-tests promise.js
 */
Promise.defer = Promise.deferred = function () {
  let dfd = {};
  dfd.promise = new Promise((resolve, reject) => {
    dfd.resolve = resolve;
    dfd.reject = reject;
  })
  return dfd;
}

module.exports = Promise;
