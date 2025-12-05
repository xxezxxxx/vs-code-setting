function 함수(숫자) {
  $(".tab-button")
    .eq(숫자)
    .on("click", function () {
      $(".tab-button").removeClass("orange");
      $(".tab-button").eq(숫자).addClass("orange");
      $(".tab-content").removeClass("show");
      $(".tab-content").eq(숫자).addClass("show");
    });
}

함수(0)
함수(1)
함수(2)