$(".tab-button").on("click", function () {
  const index = $(this).index();
  $(".tab-button").removeClass("orange");
  $(".tab-button").eq(index).addClass("orange");
  $(".tab-content").removeClass("show");
  $(".tab-content").eq(index).addClass("show");
});

for (var i = 0; i < 3; i++) {
  console.log("안녕");
}
