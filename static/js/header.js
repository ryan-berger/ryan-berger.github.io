/**
 * Created by ryanberger on 8/1/17.
 */

var sideNavToggle = false;



$(document).ready(function () {
    var sidenav = $(".sidenav");
    var overlay = $(".overlay");

    function toggle() {
        sideNavToggle = !sideNavToggle;
        if (sideNavToggle) {
            sidenav.animate({left: "0%"}, 300);
            overlay.show();
            $("body").css({"overflow-y": "hidden", position: "fixed"});
        } else {
            sidenav.animate({left: "-100%"}, 300);
            overlay.hide();
            $("body").css({"overflow-y": "auto", position: "absolute"});
        }
    }


    overlay.click(toggle);
    $(".header__menu").click(toggle)


    // Input magic
    $(".input")
});

