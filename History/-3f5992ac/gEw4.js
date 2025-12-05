$(".tab-button").on("click", function (e) {
  // const index = $(this).index();
  // $(".tab-button").removeClass("orange");
  // $(".tab-button").eq(index).addClass("orange");
  // $(".tab-content").removeClass("show");
  // $(".tab-content").eq(index).addClass("show");

  if (e.target == document.querySelectorAll(".tab-button")[0]) {
    $(".tab-button").eq(0).addClass("orange");
  }
});

console.log(document.querySelector(".tab-button").dataset.id);

for (var i = 0; i < 3; i++) {
  console.log("안녕");
}
