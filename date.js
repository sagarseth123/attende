module.exports = getDate;

function getDate() {


    var today = new Date();

    //var day = new Date().toLocaleString('en-us', { weekday: 'long' });

    var date = today.getFullYear() + '-' + compare((today.getMonth() + 1)) + "-" + compare(today.getDate());

    //var hour = today.getHours();
    //var minutes = today.getMinutes();

    function compare(x) {
        if (parseInt(x) < 10) {
            x = '0' + x;
        }
        return x;
    }



    // var time = compare(hour) + ':' + compare(minutes);

    // utc
    // var min = today.getMinutes() + 30;
    // if (min < 60) {
    //     var hour = today.getHours() + 5;
    //     var minutes = min;
    // } else {
    //     var hour = today.getHours() + 6;
    //     var minutes = min - 60;
    // }
    //var time = compare(hour) + ":" + compare(minutes);
    //utc
    //console.log(time);



    //var dateTime = date + '  ' + time
    //console.log(dateTime);


    return date;

};