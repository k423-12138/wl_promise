// 三个状态：PENDING、FULFILLED、REJECTED
const PENDING = 'PENDING'; //尚未决定
const FULFILLED = 'FULFILLED'; //完成
const REJECTED = 'REJECTED'; //拒绝

const resPrs = (prs2, x, resolve, reject) => { //解决值穿透的问题 
    if (prs2 === x) {
        return reject(new TypeError('报错了弟弟：Chaining cycle detected for promise #<Promise>'))
    }
    let called;
    if ((typeof x === 'object' && x != null) || typeof x === 'function') { //要用去全等 保证 判断的绝对正确
        try { //符合条件时 开始执行
            // 为了判断 resolve 过的就不用再 reject 了（比如 reject 和 resolve 同时调用的时候）
            let then = x.then; //防止后面的命名冲突
            if (typeof then === 'function') { //根据 prs 状态决定成功还是失败
                then.call(x, y => {
                    if (called) return;
                    called = true;
                    //解析递归  prs 中可能还存在 prs
                    resPrs(prs2, y, resolve, reject)
                }, r => { // 只要 prs的状态为失败就失败  状态不可逆
                    if (called) return;
                    called = true;
                    reject(r); //返回出状态 失败
                });
            } else {
                //当then 不为 函数时  仅仅为 一个值  直接执行 返回resolve 作为结果
                reject(r);
            }

        } catch (error) {
            //捕获错误 抛出错误
            if (called) return;
            called = true;
            reject(error)
        }
    } else {
        //如果 x 就是个普通值 直接放回
        resolve(x)
    }
}

class prs {
    constructor(executor) {
            this.status = PENDING; //开始默认状态
            this.value = undefined; //成功时 赋值的函数 
            this.reason = undefined; //失败时 赋值的函数
            this.onresolveArr = []; //存放成功时 回调
            this.onrejectArr = []; //存放失败时的回调 
            //存放回调函数 主要用于解决 异步回调的问题 
            let resolve = (value) => {
                    // 状态为 PENDING 时才可以更新状态，防止 executor 中调用了两次 resovle/reject 方法
                    if (this.status === PENDING) {
                        this.status = FULFILLED
                        this.value = value;

                        this.onresolveArr.forEach(fn => fn()); //当异步回调完成时 状态确认时  依次执行成功的回调
                    }
                }
                //该方法 为失败
            let reject = (reason) => {
                if (this.status === PENDING) {
                    this.status = REJECTED; //修改状态为 失败 
                    this.reason = reason; //

                    this.onrejectArr.forEach(fn => fn());
                }
            }

            try {
                executor(resolve, reject) //开始执行两个状态
            } catch (err) { //捕获错误
                reject(err)
            }


        }
        // 包含一个 then 方法，并接收两个参数 onFulfilled、onRejected
    then(onFulfilled, onRejected) {
        //解决 onFulfilled, onRejected 没有传值的问题
        onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : v => v;
        //因为错误的值要让后面访问到，所以这里也要跑出个错误 捕获他防止重复被捕获，不然会在之后 then 的 resolve 中捕获 
        onRejected = typeof onRejected === 'function' ? onRejected : err => { throw err };

        //每次执行 then 时 返回一个新的 prs出去
        let prs2 = new prs((resolve, reject) => {
            if (this.status === FULFILLED) {
                setTimeout(() => {
                    try {
                        let x = onFulfilled(this.value);
                        //这个 x 可能是第二次调用  也有可能是个函数 
                        resPrs(prs2, x, resolve, reject);
                    } catch (err) {
                        reject(err);
                    }
                }, 0)
            }

            if (this.status == REJECTED) { //失败时的调用 
                setTimeout(() => {
                    try {
                        let x = onRejected(this.reason);

                        resPrs(prs2, x, resolve, reject); //状态为错误时  then的链式调用 

                    } catch (error) {
                        reject(error); //错误时 结束调用 抛出错误
                    }
                }, 0)
            }

            if (this.status === PENDING) { //当处于padding 状态时 函数为异步函数时 等待状态确定
                this.onresolveArr.push(() => { // 把这个函数 存储起来 等状态确定之后 在进行执行  意思等于 将异步函数回调完成时 确认状态 进行执行 
                    setTimeout(() => {
                        try {
                            let x = onFulfilled(this.value);
                            //这个 x 可能是第二次调用  也有可能是个函数 
                            resPrs(prs2, x, resolve, reject);
                        } catch (err) {
                            reject(err);
                        }
                    }, 0);
                });

                this.onrejectArr.push(() => {
                    setTimeout(() => {
                        try {
                            let x = onRejected(this.reason);

                            resPrs(prs2, x, resolve, reject); //状态为错误时  then的链式调用 

                        } catch (error) {
                            reject(error); //错误时 结束调用 抛出错误
                        }
                    }, 0);
                })
            }
        });

        return prs2;

    }
}





export default prs