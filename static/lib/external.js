"use strict";
/*global $*/

$(document).ready(function(){
	$.get(window.path_to_nodebb + '/plugins/nodebb-plugin-recent-cards-min/render', {}, function(html) {
		html = $(html);
		if (html.length !== 5) {
			return;
		}

		$('#nodebb-plugin-recent-cards-min').html($(html[2]));
		
		var ajaxifyData = $(html[4]);
		
		if (ajaxifyData.length) {
			ajaxifyData = JSON.parse(ajaxifyData.text());

			if (ajaxifyData.recentCards.enableCarousel) {
				$('#nodebb-plugin-recent-cards-min .recent-cards').bxSlider({
					slideWidth: 292,
					minSlides: 4,
					maxSlides: 4,
					pager: ajaxifyData.recentCards.enableCarouselPagination ? true: false
				});
			} else {
				$('#nodebb-plugin-recent-cards-min .recent-cards').removeClass('carousel-mode');
			}

			if ($.timeago) {
				$('#nodebb-plugin-recent-cards-min .timeago').not('[datetime]').timeago();
			}
		}	
	});
});