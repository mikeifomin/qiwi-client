/**
 * Created with JetBrains WebStorm.
 * User: mike
 * Date: 23.07.13
 * Time: 15:09
 * To change this template use File | Settings | File Templates.
 */
a = {"asd":"3",sd:44};
function f(a) {
   if (a < 0) {
      let i = 3;
   }

   console.log(i); // ReferenceError: i is not defined
}

f(-1)