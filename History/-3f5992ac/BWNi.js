$(".tab-button")
  .eq(0)
  .on("click", function () {
    $(".tab-button").removeClass("orange");
    $(".tab-button").eq(0).addClass("orange");
  });
