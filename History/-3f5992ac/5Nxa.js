
  $(".tab-button")
  const index = $(this).index();
    .eq(숫자)
    .on("click", function () {
      $(".tab-button").removeClass("orange");
      $(".tab-button").eq(숫자).addClass("orange");
      $(".tab-content").removeClass("show");
      $(".tab-content").eq(숫자).addClass("show");
    });


